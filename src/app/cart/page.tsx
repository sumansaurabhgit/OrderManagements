import type { Metadata } from "next";

import { CartView } from "@/features/cart/cart-view";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Cart" };

export default async function CartPage() {
  const user = await getCurrentUser();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartView isSignedIn={user !== null} />
    </div>
  );
}
