import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      footer={
        <Link href="/login" className="font-medium text-emerald-800 underline underline-offset-2">
          Back to sign in
        </Link>
      }
    >
      <p className="mb-4 text-sm text-stone-600">
        Enter the email address you signed up with and we&apos;ll send you a link to choose a new password.
      </p>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
