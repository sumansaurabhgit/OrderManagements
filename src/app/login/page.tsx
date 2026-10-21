import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth-card";
import { Alert } from "@/components/ui/alert";
import { SignInForm } from "@/features/auth/auth-forms";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next = safeNextPath(searchParams.next);

  if (await getCurrentUser()) redirect(next);

  return (
    <AuthCard
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href={`/signup`} className="font-medium text-emerald-800 underline underline-offset-2">
            Create an account
          </Link>
        </>
      }
    >
      {searchParams.error === "link" ? (
        <Alert tone="error" className="mb-4">
          That link is invalid or has expired. Please request a new one.
        </Alert>
      ) : null}
      <SignInForm next={next} />
    </AuthCard>
  );
}
