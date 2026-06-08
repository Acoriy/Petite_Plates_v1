import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { saveSiteRating } from "@/lib/site-ratings";

const STAR_COUNT = 5;

const messages = {
  idle: "Choisis une note et remercie Ludo pour son menu chic.",
  loading: "Enregistrement de ta note...",
  success: "Merci pour ta note !",
  error: "Impossible d'enregistrer ta note. Réessaie plus tard.",
};

export function RatingCard() {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  const mutation = useMutation<number, Error, number>({
    mutationFn: saveSiteRating,
    onSuccess: (value) => {
      setSelectedRating(value);
    },
  });

  const activeRating = hoverRating ?? selectedRating;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="card-grimoire p-6"
    >
      <p className="font-hand text-2xl text-[var(--caramel)]">★ Donne ton avis</p>
      <h3 className="mt-2 font-display text-2xl font-bold leading-tight text-[var(--espresso)]">
        Une note simple, un grand merci.
      </h3>
      <p className="mt-3 text-sm leading-relaxed text-[var(--espresso)]/75">
        Évalue le site sur 5 étoiles. C'est anonyme, rapide et très utile pour garder le ton chic et
        chaleureux.
      </p>

      <div className="mt-6 flex items-center justify-between gap-2">
        {Array.from({ length: STAR_COUNT }, (_, index) => {
          const starValue = index + 1;
          const isActive = activeRating !== null ? starValue <= activeRating : false;

          return (
            <button
              key={starValue}
              type="button"
              aria-label={`${starValue} étoile${starValue > 1 ? "s" : ""}`}
              onMouseEnter={() => setHoverRating(starValue)}
              onMouseLeave={() => setHoverRating(null)}
              onClick={() => mutation.mutate(starValue)}
              disabled={mutation.isLoading}
              className="rounded-full p-2 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--caramel)]"
            >
              <motion.div
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                animate={{ scale: selectedRating === starValue ? 1.05 : 1 }}
              >
                <Star
                  className={`h-10 w-10 ${
                    isActive ? "text-[var(--caramel)]" : "text-[var(--espresso)]/30"
                  }`}
                  fill={isActive ? "currentColor" : "none"}
                />
              </motion.div>
            </button>
          );
        })}
      </div>

      <div
        className="mt-6 rounded-3xl border border-[var(--espresso)]/10 bg-[var(--cream)] px-4 py-4 text-sm text-[var(--espresso)] shadow-[3px_3px_0_0_var(--espresso)]"
        aria-live="polite"
      >
        <p className="font-semibold text-[var(--espresso)]">
          {mutation.isLoading
            ? messages.loading
            : mutation.isSuccess
              ? messages.success
              : messages.idle}
        </p>

        {mutation.isSuccess && selectedRating !== null ? (
          <p className="mt-2 text-base text-[var(--espresso)]/90">
            Ta note :{" "}
            <span className="font-semibold text-[var(--caramel)]">
              {selectedRating} étoile{selectedRating > 1 ? "s" : ""}
            </span>
          </p>
        ) : null}

        {mutation.isError ? (
          <p className="mt-2 text-sm text-red-600">{mutation.error?.message ?? messages.error}</p>
        ) : null}
      </div>
    </motion.div>
  );
}
