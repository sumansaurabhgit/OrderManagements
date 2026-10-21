"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { fail, ok, parseDbError, type ActionResult } from "@/lib/action-result";
import { getAdminOrNull } from "@/lib/auth";
import { parseMajorToMinor } from "@/lib/money";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminFormState = ActionResult | null;

const NOT_ADMIN = "You must be signed in as an administrator to do that.";

function fieldErrors(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
}

const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,39}$/, {
      error: "2–40 characters: letters, digits and hyphens, starting with a letter or digit.",
    }),
  name: z.string().trim().min(1, { error: "Name is required." }).max(120, { error: "At most 120 characters." }),
  description: z.string().trim().max(5000, { error: "At most 5000 characters." }),
  price: z
    .string()
    .transform((value, ctx) => {
      const minor = parseMajorToMinor(value);
      if (minor === null || minor < 30) {
        ctx.addIssue({ code: "custom", message: "Enter a price of at least £0.30, e.g. 29.99." });
        return z.NEVER;
      }
      return minor;
    }),
  imageUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((value) => value === "" || /^https:\/\//.test(value) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(value) || value.startsWith("/"), {
      error: "Use an https:// URL or upload an image.",
    })
    .transform((value) => (value === "" ? null : value)),
  isActive: z.boolean(),
});

function readProductForm(formData: FormData) {
  return {
    sku: formData.get("sku") ?? "",
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    price: formData.get("price") ?? "",
    imageUrl: formData.get("imageUrl") ?? "",
    isActive: formData.get("isActive") === "on",
  };
}

export async function createProduct(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getAdminOrNull())) return fail(NOT_ADMIN);

  const parsed = productSchema
    .extend({
      initialStock: z.coerce.number().int().min(0, { error: "Cannot be negative." }).max(100_000),
    })
    .safeParse({ ...readProductForm(formData), initialStock: formData.get("initialStock") ?? "0" });
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const { sku, name, description, price, imageUrl, isActive, initialStock } = parsed.data;
  const supabase = await createServerSupabaseClient();
  // available_stock seeds the inventory row; the insert trigger writes the
  // initial_stock ledger entry attributed to this admin.
  const { data, error } = await supabase
    .from("products")
    .insert({ sku, name, description, price, image_url: imageUrl, is_active: isActive, available_stock: initialStock })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return fail("A product with this SKU already exists.", { fieldErrors: { sku: ["SKU must be unique."] } });
    return fail(parseDbError(error, "create product").message);
  }

  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect(`/admin/products/${data.id}?created=1`);
}

export async function updateProduct(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getAdminOrNull())) return fail(NOT_ADMIN);

  const productId = z.uuid().safeParse(formData.get("productId"));
  if (!productId.success) return fail("Product not found.");

  const parsed = productSchema.safeParse(readProductForm(formData));
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const { sku, name, description, price, imageUrl, isActive } = parsed.data;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .update({ sku, name, description, price, image_url: imageUrl, is_active: isActive })
    .eq("id", productId.data)
    .select("id");

  if (error) {
    if (error.code === "23505") return fail("A product with this SKU already exists.", { fieldErrors: { sku: ["SKU must be unique."] } });
    return fail(parseDbError(error, "update product").message);
  }
  if (data.length === 0) return fail("Product not found.");

  revalidatePath(`/admin/products/${productId.data}`);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return ok(null, "Product saved.");
}

export async function setProductActive(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getAdminOrNull())) return fail(NOT_ADMIN);

  const parsed = z
    .object({ productId: z.uuid(), active: z.enum(["true", "false"]) })
    .safeParse({ productId: formData.get("productId"), active: formData.get("active") });
  if (!parsed.success) return fail("Invalid request.");

  const supabase = await createServerSupabaseClient();
  const isActive = parsed.data.active === "true";
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", parsed.data.productId);
  if (error) return fail(parseDbError(error, "toggle product").message);

  revalidatePath(`/admin/products/${parsed.data.productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return ok(null, isActive ? "Product activated." : "Product deactivated; it is hidden from the storefront.");
}

export async function adjustStock(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  if (!(await getAdminOrNull())) return fail(NOT_ADMIN);

  const parsed = z
    .object({
      productId: z.uuid(),
      delta: z.coerce
        .number({ error: "Enter a whole number." })
        .int({ error: "Enter a whole number." })
        .refine((value) => value !== 0, { error: "Adjustment cannot be zero." })
        .refine((value) => Math.abs(value) <= 100_000, { error: "At most 100,000 units per adjustment." }),
      reason: z.string().trim().min(3, { error: "Give a reason (at least 3 characters)." }).max(200),
    })
    .safeParse({ productId: formData.get("productId"), delta: formData.get("delta"), reason: formData.get("reason") });
  if (!parsed.success) return fail("Please correct the highlighted fields.", { fieldErrors: fieldErrors(parsed.error) });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("admin_adjust_stock", {
    p_product_id: parsed.data.productId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(parseDbError(error, "admin_adjust_stock").message);

  const onHand = z.object({ on_hand: z.number() }).parse(data).on_hand;
  revalidatePath(`/admin/products/${parsed.data.productId}`);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return ok(null, `Stock adjusted by ${parsed.data.delta > 0 ? "+" : ""}${parsed.data.delta}. On hand is now ${onHand}.`);
}
