"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/lib/action-result";
import { getAppUrl } from "@/lib/env";
import { safeNextPath } from "@/lib/safe-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthFormState = ActionResult | null;

const email = z.email({ error: "Enter a valid email address." }).trim().toLowerCase();
const newPassword = z
  .string()
  .min(8, { error: "Password must be at least 8 characters." })
  .max(72, { error: "Password must be at most 72 characters." });

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ email, password: z.string().min(1, { error: "Enter your password." }) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return fail(error.code === "email_not_confirmed"
      ? "Please confirm your email address before signing in."
      : "Incorrect email or password.");
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({
      displayName: z.string().trim().max(80, { error: "Name must be at most 80 characters." }),
      email,
      password: newPassword,
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      error: "Passwords do not match.",
    })
    .safeParse({
      displayName: formData.get("displayName") ?? "",
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
    });
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Display name only. The role is never taken from signup metadata.
      data: { display_name: parsed.data.displayName || null },
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=/`,
    },
  });

  if (error) {
    if (error.code === "user_already_exists") return fail("An account with this email already exists.");
    if (error.code === "weak_password") return fail(error.message);
    console.error("[auth] sign-up failed:", error);
    return fail("We couldn't create your account. Please try again.");
  }

  if (data.session) redirect("/");
  return ok(null, "Account created. Check your inbox for a confirmation link, then sign in.");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z.object({ email }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=/reset-password`,
  });

  if (error?.code === "over_email_send_rate_limit") {
    return fail("Too many reset emails were requested. Please wait a minute and try again.");
  }
  if (error) console.error("[auth] password reset request failed:", error);

  // Same response whether or not the address exists, to avoid account enumeration.
  return ok(null, "If an account exists for that address, a password reset link is on its way.");
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = z
    .object({ password: newPassword, confirmPassword: z.string() })
    .refine((data) => data.password === data.confirmPassword, {
      path: ["confirmPassword"],
      error: "Passwords do not match.",
    })
    .safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Your reset link has expired. Request a new one.");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return fail("Choose a password you haven't used before.");
    console.error("[auth] password update failed:", error);
    return fail("We couldn't update your password. Please try again.");
  }

  return ok(null, "Your password has been updated.");
}
