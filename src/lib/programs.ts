import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const DEFAULT_PROGRAMS = [
  "Yale Young Global Scholars (YYGS)",
  "Yale Young African Scholars (YYAS)",
  "Pioneers (Egypt Scholars)",
  "Common App (Application Portal)",
  "Kennedy-Lugar Youth Exchange and Study (YES) Program",
  "United World Colleges (UWC)",
  "Rise (Schmidt Futures)",
  "USAID Scholars Activity",
  "EducationUSA Competitive College Club (CCC)",
  "African Leadership Academy (ALA)",
] as const;

export const OTHER_PROGRAM_VALUE = "OTHER";

// Falls back to the hardcoded defaults if Supabase isn't reachable, so the
// dropdown is never empty even if the network/table has a problem.
export async function loadPrograms(): Promise<string[]> {
  if (!isSupabaseConfigured || !supabase) return [...DEFAULT_PROGRAMS];

  const { data, error } = await supabase
    .from("programs")
    .select("name")
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    if (error) console.error("loadPrograms:", error);
    return [...DEFAULT_PROGRAMS];
  }

  return data.map((row) => row.name as string);
}

// Adds a program to the shared table (ignored if it already exists), then
// returns the full refreshed list.
export async function addProgram(_current: string[], name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) return loadPrograms();

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("programs")
      .upsert({ name: trimmed }, { onConflict: "name", ignoreDuplicates: true });
    if (error) console.error("addProgram:", error);
  }

  return loadPrograms();
}
