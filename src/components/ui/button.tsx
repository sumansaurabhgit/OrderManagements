import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
  danger: "bg-rose-700 text-white hover:bg-rose-800",
  ghost: "text-stone-700 hover:bg-stone-100",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
