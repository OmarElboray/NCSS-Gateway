import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface ReviewerProfile {
  id: string;
  email: string;
  full_name: string | null;
  expertise_programs: string[];
}

export async function fetchReviewerProfile(userId: string): Promise<{
  profile: ReviewerProfile | null;
  error: string | null;
}> {
  if (!supabase) {
    return { profile: null, error: "Supabase is not configured." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, expertise_programs")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { profile: null, error: error.message };
  }

  if (!data) {
    return { profile: null, error: null };
  }

  return {
    profile: {
      ...data,
      expertise_programs: data.expertise_programs ?? [],
    },
    error: null,
  };
}

export async function saveReviewerExpertise(
  userId: string,
  expertisePrograms: string[]
): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      expertise_programs: expertisePrograms,
      role: "reviewer",
    })
    .eq("id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}

export async function ensureReviewerProfile(
  userId: string,
  email: string,
  fullName: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: "reviewer",
      expertise_programs: [],
    },
    { onConflict: "id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}

export { isSupabaseConfigured };
