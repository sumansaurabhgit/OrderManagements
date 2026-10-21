import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

const CONTROL =
  "block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 " +
  "placeholder:text-stone-400 aria-invalid:border-rose-600";

type FieldMeta = {
  id: string;
  label: string;
  hint?: string;
  errors?: string[];
};

function describedBy({ id, hint, errors }: FieldMeta): string | undefined {
  const ids = [hint ? `${id}-hint` : null, errors?.length ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldMessages({ id, hint, errors }: FieldMeta) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-stone-500">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-rose-700">
          {errors.join(" ")}
        </p>
      ) : null}
    </>
  );
}

export function TextField({
  id,
  label,
  hint,
  errors,
  className,
  ...inputProps
}: FieldMeta & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-800">
        {label}
      </label>
      <input
        id={id}
        className={CONTROL}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy({ id, label, hint, errors })}
        {...inputProps}
      />
      <FieldMessages id={id} label={label} hint={hint} errors={errors} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  hint,
  errors,
  className,
  ...textareaProps
}: FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-stone-800">
        {label}
      </label>
      <textarea
        id={id}
        className={CONTROL}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={describedBy({ id, label, hint, errors })}
        {...textareaProps}
      />
      <FieldMessages id={id} label={label} hint={hint} errors={errors} />
    </div>
  );
}
