import { formatMoney } from "@/lib/money";

type Item = {
  id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
};

/** Line items as snapshotted at order time (name, SKU and unit price). */
export function OrderItemsTable({ items, total }: { items: Item[]; total: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Order line items</caption>
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              Product
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Unit price
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3">
                <span className="font-medium">{item.product_name}</span>
                <span className="block font-mono text-xs text-stone-500">{item.product_sku}</span>
              </td>
              <td className="px-4 py-3 text-right">{formatMoney(item.unit_price)}</td>
              <td className="px-4 py-3 text-right">{item.quantity}</td>
              <td className="px-4 py-3 text-right font-medium">{formatMoney(item.unit_price * item.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-stone-200">
          <tr>
            <th scope="row" colSpan={3} className="px-4 py-3 text-right font-semibold">
              Order total
            </th>
            <td className="px-4 py-3 text-right font-semibold">{formatMoney(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
