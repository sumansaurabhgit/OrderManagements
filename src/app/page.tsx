import { ShopBrowser } from "@/features/catalogue/shop-browser";
import { listActiveProducts } from "@/features/catalogue/queries";

export default async function StorefrontPage() {
  const products = await listActiveProducts();
  return <ShopBrowser products={products} />;
}
