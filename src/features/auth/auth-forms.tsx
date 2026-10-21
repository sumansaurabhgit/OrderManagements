"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  requestPasswordReset,
  signIn,
  signUp,
  updatePassword,
  type AuthFormState,
} from "@/features/auth/actions";

function errorsFor(state: AuthFormState, field: string): string[] | undefined {
  return state && !state.ok ? state.fieldErrors?.[field] : undefined;
}

function FormFeedback({ state }: { state: AuthFormState }) {
  if (!state) return null;
  if (!state.ok) return <Alert tone="error">{state.error}</Alert>;
  return state.message ? <Alert tone="success">{state.message}</Alert> : null;
}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField id="email" name="email" type="email" label="Email" autoComplete="email" required errors={errorsFor(state, "email")} />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        errors={errorsFor(state, "password")}
      />
      <div className="flex items-center justify-between gap-4">
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        <Link href="/forgot-password" className="text-sm text-emerald-800 underline underline-offset-2">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUp, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      <TextField id="displayName" name="displayName" label="Name (optional)" autoComplete="name" maxLength={80} errors={errorsFor(state, "displayName")} />
      <TextField id="email" name="email" type="email" label="Email" autoComplete="email" required errors={errorsFor(state, "email")} />
      <TextField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        errors={errorsFor(state, "password")}
      />
      <TextField
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        errors={errorsFor(state, "confirmPassword")}
      />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      <TextField id="email" name="email" type="email" label="Email" autoComplete="email" required errors={errorsFor(state, "email")} />
      <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, null);
  if (state?.ok) {
    return (
      <div className="space-y-4">
        <FormFeedback state={state} />
        <Link href="/" className="text-sm text-emerald-800 underline underline-offset-2">
          Continue shopping
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormFeedback state={state} />
      <TextField
        id="password"
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        errors={errorsFor(state, "password")}
      />
      <TextField
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        errors={errorsFor(state, "confirmPassword")}
      />
      <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
