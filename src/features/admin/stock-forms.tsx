"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { adjustStock, setProductActive } from "@/features/admin/product-actions";

export function StockAdjustmentForm({ productId }: { productId: string }) {
  const [state, action] = useActionState(adjustStock, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4" noValidate>
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="productId" value={productId} />
      <TextField
        id="delta"
        name="delta"
        label="Adjustment"
        type="number"
        inputMode="numeric"
        step={1}
        required
        hint="Positive to add stock (e.g. 10), negative to remove (e.g. -2)."
        errors={errors?.delta}
      />
      <TextField
        id="reason"
        name="reason"
        label="Reason"
        required
        maxLength={200}
        hint="Recorded in the stock movement log, e.g. “Supplier delivery” or “Damaged in warehouse”."
        errors={errors?.reason}
      />
      <SubmitButton pendingLabel="Adjusting…">Adjust stock</SubmitButton>
    </form>
  );
}

export function ProductActiveToggle({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [state, action] = useActionState(setProductActive, null);

  return (
    <form action={action} className="space-y-3">
      {state && !state.ok ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok && state.message ? <Alert tone="success">{state.message}</Alert> : null}
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="active" value={isActive ? "false" : "true"} />
      <SubmitButton variant={isActive ? "danger" : "primary"} pendingLabel="Updating…">
        {isActive ? "Deactivate product" : "Activate product"}
      </SubmitButton>
    </form>
  );
}
