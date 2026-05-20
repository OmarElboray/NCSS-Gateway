import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { SubmissionStatus } from "@/lib/portal-types";

export interface CreateSubmissionInput {
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  program: string;
  title: string;
  essay: string;
  isAnonymous: boolean;
}

export async function insertSubmission(
  input: CreateSubmissionInput
): Promise<{ id: string | null; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { id: null, error: null };
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      student_user_id: input.studentUserId,
      student_name: input.studentName,
      student_email: input.studentEmail,
      program: input.program,
      title: input.title,
      essay: input.essay,
      is_anonymous: input.isAnonymous,
      status: "Pending",
      feedback: "",
    })
    .select("id")
    .single();

  if (error) {
    return { id: null, error: error.message };
  }

  return { id: data.id as string, error: null };
}

export async function updateSubmissionInDb(
  id: string,
  updates: { status?: SubmissionStatus; feedback?: string }
): Promise<{ ok: boolean; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { ok: true, error: null };
  }

  const payload: Record<string, string> = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.feedback !== undefined) payload.feedback = updates.feedback;

  const { error } = await supabase.from("submissions").update(payload).eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, error: null };
}
