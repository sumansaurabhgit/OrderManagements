"use client";

import { useActionState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { refundOrder, transitionOrder, type OrderActionState } from "@/features/admin/order-actions";
import type { OrderStatus } from "@/lib/orders";

function Feedback({ state }: { state: OrderActionState }) {
  if (!state) return null;
  if (!state.ok) return <Alert tone="error">{state.error}</Alert>;
  return state.message ? <Alert tone="success">{state.message}</Alert> : null;
}

function confirmSubmit(message: string) {
  return (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

function TransitionForm({ orderId, status, label, confirmMessage, variant }: {
  orderId: string;
  status: "fulfilled" | "cancelled";
  label: string;
  confirmMessage: string;
  variant: "primary" | "danger" | "secondary";
}) {
  const [state, action] = useActionState(transitionOrder, null);
  const noteId = `note-${status}`;
  return (
    <form action={action} onSubmit={confirmSubmit(confirmMessage)} className="space-y-3">
      <Feedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="status" value={status} />
      <div>
        <label htmlFor={noteId} className="mb-1 block text-sm font-medium text-stone-800">
          Note (optional)
        </label>
        <input
          id={noteId}
          name="note"
          maxLength={500}
          className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <SubmitButton variant={variant} pendingLabel="Updating…">
        {label}
      </SubmitButton>
    </form>
  );
}

function RefundForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(refundOrder, null);
  return (
    <form
      action={action}
      onSubmit={confirmSubmit("Issue a full refund through Stripe? This cannot be undone.")}
      className="space-y-3"
    >
      <Feedback state={state} />
      <input type="hidden" name="orderId" value={orderId} />
      <SubmitButton variant="danger" pendingLabel="Requesting refund…">
        Issue full refund
      </SubmitButton>
    </form>
  );
}

/** Only the transitions valid from the current status are offered; the server re-validates. */
export function OrderControls({
  orderId,
  status,
  refundPending,
}: {
  orderId: string;
  status: OrderStatus;
  refundPending: boolean;
}) {
  if (status === "pending_payment") {
    return (
      <TransitionForm
        orderId={orderId}
        status="cancelled"
        label="Cancel order"
        variant="danger"
        confirmMessage="Cancel this unpaid order? The Stripe checkout will be closed and stock released."
      />
    );
  }

  if (status === "paid") {
    if (refundPending) {
      return (
        <Alert tone="info">
          A full refund has been requested in Stripe. The order will move to Refunded when Stripe confirms it.
        </Alert>
      );
    }
    return (
      <div className="space-y-6">
        <TransitionForm
          orderId={orderId}
          status="fulfilled"
          label="Mark as fulfilled"
          variant="primary"
          confirmMessage="Mark this order as fulfilled?"
        />
        <div className="border-t border-stone-200 pt-4">
          <RefundForm orderId={orderId} />
        </div>
      </div>
    );
  }

  return <p className="text-sm text-stone-600">No further actions are available for this order.</p>;
}
