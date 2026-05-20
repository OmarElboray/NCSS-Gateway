import type { PortalUser, UserRole } from "@/lib/portal-types";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export interface AuthProfile {
  role: UserRole;
  email: string;
  full_name: string | null;
}

export function dashboardPathForRole(role: UserRole): string {
  return role === "reviewer" ? "/reviewer-dashboard" : "/applicant-dashboard";
}

function parseRole(value: string | null | undefined): UserRole {
  return value === "reviewer" ? "reviewer" : "applicant";
}

/** Load role and display fields from public.profiles (source of truth for routing). */
export async function fetchAuthProfile(userId: string): Promise<{
  profile: AuthProfile | null;
  error: string | null;
}> {
  if (!supabase) {
    return { profile: null, error: "Supabase is not configured." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role, email, full_name")
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
      role: parseRole(data.role),
      email: data.email,
      full_name: data.full_name,
    },
    error: null,
  };
}

export function portalUserFromAuth(
  authUser: User,
  profile: AuthProfile | null
): PortalUser {
  const meta = authUser.user_metadata ?? {};
  const email = profile?.email ?? authUser.email ?? "";
  return {
    id: authUser.id,
    name:
      profile?.full_name ??
      (meta.full_name as string | undefined) ??
      authUser.email ??
      "User",
    email,
    role: profile?.role ?? parseRole(meta.role as string | undefined),
  };
}
