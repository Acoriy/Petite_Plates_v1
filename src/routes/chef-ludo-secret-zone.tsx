import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import type { Session } from "@supabase/supabase-js";
import { Plus, Pencil, Trash2, LogOut, ChefHat, Eye, Heart, ExternalLink, X } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { listAdminRecipes, listCategoriesForAdmin } from "@/lib/admin-dashboard";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { CategoryImage } from "@/components/site/CategoryImage";
import { humanizeError } from "@/lib/form-errors";
import { slugifyTitle } from "@/lib/slugify";
import type { Ingredient, Instruction, Recipe } from "@/lib/recipes";

export const Route = createFileRoute("/chef-ludo-secret-zone")({
  head: () => ({
    meta: [{ title: "Espace Ludo" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: LudoAdmin,
});

const authSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(128),
});

type AuthPhase = "boot" | "guest" | "checking_role" | "admin" | "not_admin";

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;

const createImageElement = async (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Impossible de charger l'image pour compression"));
    };
    image.src = url;
  });
};

const compressImageFile = async (file: File): Promise<File> => {
  if (file.size <= MAX_UPLOAD_SIZE) return file;

  const image = await createImageElement(file);
  const maxDimension = 1920;
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Impossible de créer le contexte de dessin pour compression");
  }
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );

  if (!blob) {
    throw new Error("La compression de l'image a échoué");
  }

  const name = file.name.replace(/\.[^.]+$/, ".jpg");
  return new File([blob], name, { type: "image/jpeg" });
};

function LudoAdmin() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<AuthPhase>("boot");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let active = true;

    const resolveRole = async (session: Session | null) => {
      if (!active) return;
      if (!session) {
        setPhase("guest");
        return;
      }
      setPhase("checking_role");
      const { data: role, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("[admin auth]", error);
        setPhase("not_admin");
        return;
      }
      setPhase(role ? "admin" : "not_admin");
    };

    supabase.auth.getSession().then(({ data }) => resolveRole(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveRole(session);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [mounted]);

  if (!mounted || phase === "boot") {
    return (
      <div className="container mx-auto py-32 text-center text-muted-foreground">Chargement…</div>
    );
  }
  if (phase === "guest") return <LoginCard />;
  if (phase === "checking_role") {
    return (
      <div className="container mx-auto py-32 text-center text-muted-foreground">
        Vérification des droits…
      </div>
    );
  }
  if (phase === "not_admin") return <NotAuthorized />;
  return <AdminPanel />;
}

function LoginCard() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = authSchema.safeParse(form);
    if (!res.success) {
      toast.error(res.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(res.data);
      if (error) throw error;
      toast.success("Bienvenue Ludo !");
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-[var(--shadow-warm)]">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--gradient-warm)] text-primary-foreground">
            <ChefHat className="h-6 w-6" />
          </div>
          <p className="mt-4 font-hand text-2xl text-primary">Espace privé</p>
          <h1 className="mt-1 font-display text-3xl font-bold">Bonjour Ludo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connectez-vous pour gérer vos recettes.
          </p>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="Email"
            className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mot de passe"
            className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-sm outline-none focus:border-primary"
          />
          <button
            disabled={busy}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-warm)] transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? "…" : "Se connecter"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Si vous n'êtes pas Ludo, retournez à{" "}
          <Link to="/" className="text-primary hover:underline">
            l'accueil
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

async function signOutAndLeave() {
  await supabase.auth.signOut();
  window.location.href = "/";
}

function NotAuthorized() {
  return (
    <div className="container mx-auto py-24 text-center">
      <h1 className="font-display text-4xl font-bold">Accès réservé</h1>
      <p className="mt-3 text-muted-foreground">Ce compte n'a pas les droits d'administration.</p>
      <button
        onClick={() => void signOutAndLeave()}
        className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
      >
        Se déconnecter
      </button>
    </div>
  );
}

function AdminPanel() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"recipes" | "categories">("recipes");
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [creating, setCreating] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const { data: recipes = [], refetch } = useQuery({
    queryKey: ["dash-recipes"],
    queryFn: listAdminRecipes,
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: listCategoriesForAdmin,
  });

  const logout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      qc.clear();
      window.location.href = "/";
    } catch (err) {
      toast.error(humanizeError(err));
      setLoggingOut(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette recette ?")) return;
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Recette supprimée");
    refetch();
    qc.invalidateQueries({ queryKey: ["recipes"] });
  };

  return (
    <div className="container mx-auto px-4 py-12 md:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Espace Ludo</h1>
            <p className="text-sm text-muted-foreground">Vos recettes, vos stats, votre cuisine.</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === "recipes" && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Nouvelle recette
            </button>
          )}
          <button
            disabled={loggingOut}
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" /> {loggingOut ? "Déconnexion…" : "Sortir"}
          </button>
        </div>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Stat label="Recettes" value={recipes.length} />
        <Stat label="Catégories" value={cats.length} />
        <Stat
          label="Vues totales"
          value={recipes.reduce((s, r) => s + r.views, 0)}
          icon={<Eye className="h-4 w-4" />}
        />
        <Stat
          label="J'aime totaux"
          value={recipes.reduce((s, r) => s + r.likes, 0)}
          icon={<Heart className="h-4 w-4" />}
        />
      </div>

      <div className="mt-8 flex gap-2 rounded-full bg-secondary p-1">
        <button
          type="button"
          onClick={() => setTab("recipes")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === "recipes" ? "bg-primary text-primary-foreground" : ""}`}
        >
          Recettes
        </button>
        <button
          type="button"
          onClick={() => setTab("categories")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === "categories" ? "bg-primary text-primary-foreground" : ""}`}
        >
          Catégories
        </button>
      </div>

      {tab === "categories" ? (
        <div className="mt-8">
          <CategoryManager />
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="p-4">Titre</th>
                <th className="p-4 hidden md:table-cell">Catégorie</th>
                <th className="p-4 hidden lg:table-cell">Statut</th>
                <th className="p-4 hidden md:table-cell">Vues</th>
                <th className="p-4 hidden md:table-cell">♥</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-4 font-semibold">
                    <Link to={`/recette/${r.id}`} className="hover:text-primary hover:underline">
                      {r.title} {r.featured && "⭐"}
                    </Link>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    {r.category ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-8 w-8 overflow-hidden rounded-lg">
                          <CategoryImage
                            category={r.category}
                            className="h-8 w-8"
                            rounded="rounded-lg"
                          />
                        </span>
                        {r.category.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-4 hidden lg:table-cell">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "published" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}
                    >
                      {r.status === "published" ? "Publiée" : "Brouillon"}
                    </span>
                  </td>
                  <td className="p-4 hidden md:table-cell">{r.views}</td>
                  <td className="p-4 hidden md:table-cell">{r.likes}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Link
                        to={`/recette/${r.id}`}
                        className="rounded-full bg-secondary p-2 hover:bg-primary hover:text-primary-foreground"
                        title="Voir la recette"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setEditing(r)}
                        className="rounded-full bg-secondary p-2 hover:bg-primary hover:text-primary-foreground"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => del(r.id)}
                        className="rounded-full bg-secondary p-2 hover:bg-destructive hover:text-destructive-foreground"
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recipes.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Aucune recette pour l'instant. Cliquez sur « Nouvelle recette ».
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "recipes" && (creating || editing) && (
        <RecipeForm
          recipe={editing}
          categories={cats}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            refetch();
            qc.invalidateQueries({ queryKey: ["recipes"] });
            qc.invalidateQueries({ queryKey: ["recipes", "all"] });
            qc.invalidateQueries({ queryKey: ["recipes", "latest"] });
            qc.invalidateQueries({ queryKey: ["recipes", "featured"] });
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold">{value.toLocaleString("fr-FR")}</p>
    </div>
  );
}

const recipeSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9-]+$/, "slug: lettres, chiffres, tirets"),
  description: z.string().trim().min(10).max(2000),
  category_id: z.string().uuid().nullable(),
  prep_time: z
    .string()
    .regex(/^\d+h[0-5]\dmin$/, "Le format du temps doit être XhXXmin comme 1h30min"),
  cook_time: z
    .string()
    .regex(/^\d+h[0-5]\dmin$/, "Le format du temps doit être XhXXmin comme 0h20min"),
  servings: z.coerce.number().min(1).max(99),
  difficulty: z.enum(["Facile", "Moyen", "Difficile"]),
  cover_image: z.string().url().or(z.literal("")),
  chef_notes: z.string().max(2000).or(z.literal("")).optional(),
  featured: z.boolean(),
  status: z.enum(["draft", "published"]),
});

const ingredientSchema = z.object({
  name: z.string().trim().min(1, "Ingrédient: nom requis").max(200),
  quantity: z.string().trim().max(50).optional().default(""),
  unit: z.string().trim().max(30).optional().default(""),
});

const instructionSchema = z.object({
  step: z.number().int().min(1),
  text: z.string().trim().min(1, "Étape: texte requis").max(5000),
});

function normalizeIngredients(items: Ingredient[]): Ingredient[] {
  const cleaned = items
    .map((i) => ({
      name: (i.name ?? "").trim(),
      quantity: (i.quantity ?? "").trim(),
      unit: (i.unit ?? "").trim(),
    }))
    .filter((i) => i.name.length > 0);
  return cleaned.length > 0 ? cleaned : [{ name: "", quantity: "", unit: "" }];
}

function renumberInstructionsKeepEmpty(items: Instruction[]): Instruction[] {
  const numbered = items.map((s, idx) => ({ step: idx + 1, text: s.text ?? "" }));
  return numbered.length > 0 ? numbered : [{ step: 1, text: "" }];
}

function normalizeInstructionsForSave(items: Instruction[]): Instruction[] {
  const cleaned = items
    .map((s) => ({ text: (s.text ?? "").trim() }))
    .filter((s) => s.text.length > 0);
  const numbered = cleaned.map((s, idx) => ({ step: idx + 1, text: s.text }));
  return numbered.length > 0 ? numbered : [{ step: 1, text: "" }];
}

function parseDurationString(value: string | number, fallbackHours = 0, fallbackMinutes = 0) {
  const normalized = String(value);
  const match = normalized.match(/^(\d+)h([0-5]\d)min$/);
  if (!match) return { hours: fallbackHours, minutes: fallbackMinutes };
  return { hours: Number(match[1]), minutes: Number(match[2]) };
}

function formatDurationString(hours: number, minutes: number) {
  return `${hours}h${minutes.toString().padStart(2, "0")}min`;
}

function RecipeForm({
  recipe,
  categories,
  onClose,
  onSaved,
}: {
  recipe: Recipe | null;
  categories: { id: string; name: string; image_url?: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: recipe?.title ?? "",
    description: recipe?.description ?? "",
    category_id: recipe?.category_id ?? "",
    prep_time: recipe?.prep_time ?? "0h10min",
    cook_time: recipe?.cook_time ?? "0h20min",
    servings: recipe?.servings ?? 4,
    difficulty: (recipe?.difficulty ?? "Facile") as "Facile" | "Moyen" | "Difficile",
    cover_image: recipe?.cover_image ?? "",
    featured: recipe?.featured ?? false,
    status: (recipe?.status ?? "published") as "draft" | "published",
    ingredients: normalizeIngredients(
      (recipe?.ingredients as Ingredient[] | undefined) ?? [{ name: "", quantity: "", unit: "" }],
    ),
    instructions: renumberInstructionsKeepEmpty(
      (recipe?.instructions as Instruction[] | undefined) ?? [{ step: 1, text: "" }],
    ),
    chef_notes: (recipe as any)?.chef_notes ?? recipe?.astuces ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const prepInitial = parseDurationString(recipe?.prep_time ?? "0h10min", 0, 10);
  const cookInitial = parseDurationString(recipe?.cook_time ?? "0h20min", 0, 20);
  const [prepHours, setPrepHours] = useState(prepInitial.hours);
  const [prepMinutes, setPrepMinutes] = useState(prepInitial.minutes);
  const [cookHours, setCookHours] = useState(cookInitial.hours);
  const [cookMinutes, setCookMinutes] = useState(cookInitial.minutes);

  const storageKey = `recipe-form-${recipe?.id ?? "new"}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        const {
          prepHours: savedPrepHours,
          prepMinutes: savedPrepMinutes,
          cookHours: savedCookHours,
          cookMinutes: savedCookMinutes,
          ...savedForm
        } = parsed;
        setForm((f) => ({ ...f, ...savedForm }));
        if (typeof savedPrepHours === "number") setPrepHours(savedPrepHours);
        if (typeof savedPrepMinutes === "number") setPrepMinutes(savedPrepMinutes);
        if (typeof savedCookHours === "number") setCookHours(savedCookHours);
        if (typeof savedCookMinutes === "number") setCookMinutes(savedCookMinutes);
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          ...form,
          prepHours,
          prepMinutes,
          cookHours,
          cookMinutes,
        }),
      );
    } catch (e) {
      // noop
    }
  }, [form, prepHours, prepMinutes, cookHours, cookMinutes, storageKey]);

  const uploadImage = async (file: File) => {
    setUploadError(null);
    try {
      if (!file) {
        throw new Error("Aucun fichier sélectionné.");
      }
      if (!file.type.startsWith("image/")) {
        throw new Error("Le fichier doit être une image.");
      }

      const fileToUpload = file.size > MAX_UPLOAD_SIZE ? await compressImageFile(file) : file;
      const ext = fileToUpload.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage.from("recipe-images").upload(path, fileToUpload);
      if (error) {
        throw error;
      }

      const { data } = supabase.storage.from("recipe-images").getPublicUrl(path);
      setForm((f) => ({ ...f, cover_image: data.publicUrl }));
      toast.success("Image envoyée");
    } catch (rawError) {
      const message = rawError instanceof Error ? rawError.message : String(rawError);
      setUploadError(message);
      toast.error(message);
      alert(`Échec de l'upload : ${message}`);
      console.error("Upload image error:", rawError);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const slugAuto = slugifyTitle(form.title);
      const prep_time = formatDurationString(prepHours, prepMinutes);
      const cook_time = formatDurationString(cookHours, cookMinutes);
      const base = recipeSchema.parse({
        ...form,
        slug: slugAuto,
        category_id: form.category_id || null,
        prep_time,
        cook_time,
      });
      // Supabase: on envoie prep_time et cook_time en texte au format "XhXXmin"
      const ingredients = normalizeIngredients(form.ingredients);
      const instructions = normalizeInstructionsForSave(form.instructions);
      const parsedIngredients = z
        .array(ingredientSchema)
        .parse(ingredients.filter((i) => i.name.trim().length > 0));
      const parsedInstructions = z
        .array(instructionSchema)
        .parse(instructions.filter((s) => s.text.trim().length > 0));

      let publishedPatch: { published_at: string | null } = {};
      if (recipe && recipe.status === "draft" && base.status === "published") {
        publishedPatch = { published_at: new Date().toISOString() };
      }
      const payload = {
        ...base,
        ingredients: parsedIngredients,
        instructions: parsedInstructions,
        cover_image: base.cover_image || null,
        chef_notes: form.chef_notes || null,
        ...publishedPatch,
      };

      const executeSave = async (payloadToSend: typeof payload) =>
        recipe
          ? await supabase.from("recipes").update(payloadToSend).eq("id", recipe.id)
          : await supabase
              .from("recipes")
              .insert({
                ...payloadToSend,
                published_at: base.status === "published" ? new Date().toISOString() : null,
              });

      let result = await executeSave(payload);
      if (result.error && result.error.message?.includes("chef_notes")) {
        const { chef_notes, ...withoutNotes } = payload;
        result = await executeSave(withoutNotes as typeof payload);
      }
      if (result.error) throw result.error;
      toast.success(recipe ? "Recette mise à jour" : "Recette créée");
      try {
        localStorage.removeItem(`recipe-form-${recipe?.id ?? "new"}`);
      } catch {}
      onSaved();
    } catch (err) {
      toast.error(humanizeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-espresso/70 p-4">
      <motion.form
        onSubmit={save}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card p-6 shadow-[var(--shadow-deep)] relative"
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-primary-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-2xl font-bold">
          {recipe ? "Modifier" : "Nouvelle"} recette
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <input
              placeholder="Titre de la recette"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
            />
            <p className="mt-1.5 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground/80">Lien automatique </span>
              /carnet-de-recettes/
              <span className="font-mono font-semibold text-primary">
                {slugifyTitle(form.title) || "..."}
              </span>
            </p>
          </div>
          <textarea
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm"
          />
          <div className="space-y-2">
            <input
              placeholder="URL image de couverture"
              value={form.cover_image}
              onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
              className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
            />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-background py-3 text-sm text-muted-foreground hover:border-primary">
              📷 Choisir une image (upload)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await uploadImage(file);
                  e.target.value = "";
                }}
              />
            </label>
            {uploadError ? (
              <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                Erreur upload : {uploadError}
              </div>
            ) : null}
            {form.cover_image && (
              <img src={form.cover_image} alt="" className="h-32 w-full rounded-xl object-cover" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border-2 border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Préparation</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  placeholder="h"
                  value={prepHours}
                  onChange={(e) => setPrepHours(Math.max(0, +e.target.value))}
                  className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="min"
                  value={prepMinutes}
                  onChange={(e) => setPrepMinutes(Math.max(0, Math.min(59, +e.target.value)))}
                  className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
                />
              </div>
            </div>
            <div className="rounded-xl border-2 border-border bg-background p-3">
              <p className="text-xs text-muted-foreground">Cuisson</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  placeholder="h"
                  value={cookHours}
                  onChange={(e) => setCookHours(Math.max(0, +e.target.value))}
                  className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="min"
                  value={cookMinutes}
                  onChange={(e) => setCookMinutes(Math.max(0, Math.min(59, +e.target.value)))}
                  className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
                />
              </div>
            </div>
            <input
              type="number"
              placeholder="Portions"
              value={form.servings}
              onChange={(e) => setForm({ ...form, servings: +e.target.value })}
              className="h-11 rounded-xl border-2 border-border bg-background px-3 text-sm"
            />
            <select
              value={form.difficulty}
              onChange={(e) =>
                setForm({ ...form, difficulty: e.target.value as "Facile" | "Moyen" | "Difficile" })
              }
              className="h-11 rounded-xl border-2 border-border bg-background px-3 text-sm"
            >
              <option>Facile</option>
              <option>Moyen</option>
              <option>Difficile</option>
            </select>
          </div>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="h-11 w-full rounded-xl border-2 border-border bg-background px-3 text-sm"
          >
            <option value="">— Sans catégorie —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Ingrédients</p>
                <p className="text-xs text-muted-foreground">
                  Saisie simple. Tu peux ajouter/supprimer des lignes.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    ingredients: [...f.ingredients, { name: "", quantity: "", unit: "" }],
                  }))
                }
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-semibold hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Ajouter
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {form.ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    value={ing.quantity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ingredients: f.ingredients.map((x, i) =>
                          i === idx ? { ...x, quantity: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="Qté"
                    className="col-span-3 h-10 rounded-xl border-2 border-border bg-card px-3 text-sm"
                  />
                  <input
                    value={ing.unit}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ingredients: f.ingredients.map((x, i) =>
                          i === idx ? { ...x, unit: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="Unité"
                    className="col-span-3 h-10 rounded-xl border-2 border-border bg-card px-3 text-sm"
                  />
                  <input
                    value={ing.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        ingredients: f.ingredients.map((x, i) =>
                          i === idx ? { ...x, name: e.target.value } : x,
                        ),
                      }))
                    }
                    placeholder="Nom de l’ingrédient (ex: Farine)"
                    className="col-span-5 h-10 rounded-xl border-2 border-border bg-card px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => {
                        const next = f.ingredients.filter((_, i) => i !== idx);
                        return { ...f, ingredients: normalizeIngredients(next) };
                      })
                    }
                    className="col-span-1 grid h-10 place-items-center rounded-xl bg-secondary text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Étapes</p>
                <p className="text-xs text-muted-foreground">
                  Une étape = un bloc. L’ordre se renumérote automatiquement.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    instructions: renumberInstructionsKeepEmpty([
                      ...f.instructions,
                      { step: f.instructions.length + 1, text: "" },
                    ]),
                  }))
                }
                className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-2 text-xs font-semibold hover:bg-primary hover:text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Ajouter
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {form.instructions.map((step, idx) => (
                <div key={idx} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">Étape {idx + 1}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => {
                          const next = f.instructions.filter((_, i) => i !== idx);
                          return { ...f, instructions: renumberInstructionsKeepEmpty(next) };
                        })
                      }
                      className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="h-4 w-4" /> Supprimer
                    </button>
                  </div>
                  <textarea
                    value={step.text}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        instructions: renumberInstructionsKeepEmpty(
                          f.instructions.map((x, i) =>
                            i === idx ? { ...x, text: e.target.value } : x,
                          ),
                        ),
                      }))
                    }
                    rows={3}
                    placeholder="Décris l’étape clairement…"
                    className="mt-2 w-full rounded-xl border-2 border-border bg-background p-3 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-yellow-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Remarques du Chef</p>
              <p className="text-xs text-muted-foreground">Conseils, variantes, astuces</p>
            </div>
            <textarea
              value={form.chef_notes}
              onChange={(e) => setForm({ ...form, chef_notes: e.target.value })}
              rows={4}
              placeholder="Par ex : Remplacez le beurre par du ghee pour plus de saveurs…"
              className="mt-3 w-full rounded-xl border-2 border-border bg-background p-3 text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
              />{" "}
              Mise en avant ⭐
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as "draft" | "published" })
              }
              className="h-9 rounded-xl border-2 border-border bg-background px-3 text-sm"
            >
              <option value="published">Publiée</option>
              <option value="draft">Brouillon</option>
            </select>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-full bg-secondary py-3 text-sm font-semibold"
          >
            Fermer
          </button>
          <button
            disabled={busy}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "…" : "Enregistrer"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
