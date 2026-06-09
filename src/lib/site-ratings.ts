import { supabase } from "@/integrations/supabase/client";

export type SiteRatingInsert = {
  rating: number;
};

export async function saveSiteRating(rating: number) {
  if (rating < 1 || rating > 5) {
    throw new Error("La note doit être comprise entre 1 et 5 étoiles.");
  }

  const { error } = await supabase
    .from("site_ratings")
    .insert<SiteRatingInsert>({ rating }, { returning: "minimal" });

  if (error) {
    throw error;
  }

  return rating;
}
