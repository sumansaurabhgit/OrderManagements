/** Single-currency store. All amounts are integers in minor units (pence). */
export const CURRENCY = "gbp";

const formatter = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatMoney(minorUnits: number): string {
  return formatter.format(minorUnits / 100);
}

/** "29.99" -> 2999. Returns null for anything that is not a valid amount. */
export function parseMajorToMinor(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [pounds, pence = ""] = trimmed.split(".");
  return Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
}

/** 2999 -> "29.99" (for form inputs). */
export function minorToMajorString(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}
