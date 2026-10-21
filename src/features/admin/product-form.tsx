"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { TextAreaField, TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ImageUploadField } from "@/features/admin/image-upload-field";
import { createProduct, updateProduct, type AdminFormState } from "@/features/admin/product-actions";
import { minorToMajorString } from "@/lib/money";

type ProductFormProps = {
  product?: {
    id: string;
    sku: string;
    name: string;
    description: string;
    price: number;
    image_url: string | null;
    is_active: boolean;
  };
};

function errorsFor(state: AdminFormState, field: string) {
  return state && !state.ok ? state.fieldErrors?.[field] : undefined;
}

export function ProductForm({ product }: ProductFormProps) {
  const [state, action] = useActionState(product ? updateProduct : createProduct, null);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      {product ? <input type="hidden" name="productId" value={product.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="sku"
          name="sku"
          label="SKU"
          defaultValue={product?.sku}
          required
          autoCapitalize="characters"
          hint="Letters, digits and hyphens, e.g. LG-MUG-001."
          errors={errorsFor(state, "sku")}
        />
        <TextField
          id="price"
          name="price"
          label="Price (£)"
          inputMode="decimal"
          defaultValue={product ? minorToMajorString(product.price) : ""}
          required
          hint="Stored in pence."
          errors={errorsFor(state, "price")}
        />
      </div>
      <TextField id="name" name="name" label="Name" defaultValue={product?.name} required maxLength={120} errors={errorsFor(state, "name")} />
      <TextAreaField
        id="description"
        name="description"
        label="Description"
        rows={4}
        defaultValue={product?.description}
        maxLength={5000}
        errors={errorsFor(state, "description")}
      />
      {product ? null : (
        <TextField
          id="initialStock"
          name="initialStock"
          label="Initial stock"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue="0"
          hint="Recorded in the stock movement log. Later changes use stock adjustments."
          errors={errorsFor(state, "initialStock")}
        />
      )}
      <ImageUploadField defaultValue={product?.image_url ?? null} errors={errorsFor(state, "imageUrl")} />
      <div className="flex items-center gap-2">
        <input
          id="isActive"
          name="isActive"
          type="checkbox"
          defaultChecked={product?.is_active ?? true}
          className="size-4 rounded border-stone-300"
        />
        <label htmlFor="isActive" className="text-sm font-medium text-stone-800">
          Active (visible and purchasable on the storefront)
        </label>
      </div>
      <SubmitButton pendingLabel="Saving…">{product ? "Save changes" : "Create product"}</SubmitButton>
    </form>
  );
}
