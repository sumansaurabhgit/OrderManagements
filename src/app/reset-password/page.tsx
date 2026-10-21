import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "@/features/auth/auth-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  // The reset email link signs the user in via /auth/callback before landing here.
  const user = await getCurrentUser();

  return (
    <AuthCard title="Choose a new password">
      {user ? (
        <ResetPasswordForm />
      ) : (
        <Alert tone="warning">
          Your reset link has expired or was already used.{" "}
          <Link href="/forgot-password" className="font-medium underline underline-offset-2">
            Request a new link
          </Link>
          .
        </Alert>
      )}
    </AuthCard>
  );
}
