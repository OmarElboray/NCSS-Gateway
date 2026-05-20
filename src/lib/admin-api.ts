import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface BulkInviteResult {
  created: string[];
  updated: string[];
  failed: { email: string; error: string }[];
}

export async function bulkInviteReviewers(
  emails: string[]
): Promise<{ data: BulkInviteResult | null; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: "Supabase is not configured." };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { data: null, error: "You must be signed in." };
  }

  const { data, error } = await supabase.functions.invoke("bulk-invite-reviewers", {
    body: { emails },
  });

  if (error) {
    return { data: null, error: error.message };
  }

  const payload = data as BulkInviteResult & { error?: string };

  if (payload?.error) {
    return { data: null, error: payload.error };
  }

  return { data: payload, error: null };
}
