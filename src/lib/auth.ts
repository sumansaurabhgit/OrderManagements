import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Enums"]["user_role"];

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
};

/**
 * Data Access Layer entry point. Verifies the session with Supabase Auth
 * (getUser() round-trips to the Auth server; cookie contents are never
 * trusted) and reads the role from the `profiles` table. Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role, display_name")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    displayName: profile.display_name,
  };
});

/** Pages: redirect to sign-in when there is no session. */
export async function requireAuth(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** Admin pages: require a session and the `admin` role from the database. */
export async function requireAdmin(nextPath = "/admin"): Promise<SessionUser> {
  const user = await requireAuth(nextPath);
  if (user.role !== "admin") notFound();
  return user;
}

/** Server Actions: returns the admin, or null so the action can return a typed error. */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}
