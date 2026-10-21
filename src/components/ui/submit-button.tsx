"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { buttonClasses } from "@/components/ui/button";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
};

/** Submit button that reflects the enclosing form's pending state. */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  className,
  disabled,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
