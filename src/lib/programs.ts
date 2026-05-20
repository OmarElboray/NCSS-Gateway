export const PROGRAMS_STORAGE_KEY = "school_portal_programs";

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

export function loadPrograms(): string[] {
  try {
    const raw = localStorage.getItem(PROGRAMS_STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as string[];
      if (Array.isArray(saved) && saved.length > 0) {
        return mergePrograms(saved);
      }
    }
  } catch {
    /* ignore */
  }

  const initial = [...DEFAULT_PROGRAMS];
  localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(initial));
  return initial;
}

export function mergePrograms(saved: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const name of [...DEFAULT_PROGRAMS, ...saved]) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    merged.push(trimmed);
  }

  return merged;
}

export function savePrograms(programs: string[]): void {
  localStorage.setItem(PROGRAMS_STORAGE_KEY, JSON.stringify(programs));
}

export function addProgram(programs: string[], name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed || programs.includes(trimmed)) return programs;
  const updated = [...programs, trimmed];
  savePrograms(updated);
  return updated;
}
