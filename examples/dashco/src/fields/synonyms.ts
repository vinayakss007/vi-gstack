/**
 * Hand-curated synonym dictionary for common dataset fields.
 *
 * Each entry maps a canonical token to the set of words that mean the same
 * thing in business datasets. The matcher uses this to bridge cases like
 * `Total $` -> `revenue` where Jaccard alone would score zero.
 *
 * Deterministic. Add entries as your customers' real CSVs reveal new
 * vocabulary. Do not let AI invent synonyms here at runtime.
 */

export type SynonymGroup = readonly string[];

export const SYNONYM_GROUPS: readonly SynonymGroup[] = [
  // money
  ["revenue", "total", "amount", "sales", "price", "sum", "value", "gmv"],
  // time
  ["date", "time", "timestamp", "datetime", "ts", "when", "created", "occurred"],
  // counts
  ["quantity", "qty", "count", "units", "n", "num"],
  // people
  ["customer", "cust", "user", "client", "account", "buyer", "member", "subscriber"],
  // products
  ["product", "item", "sku", "good", "asset", "service"],
  // identifiers
  ["id", "identifier", "key", "uid", "uuid"],
  // contact
  ["email", "mail"],
  ["phone", "telephone", "mobile", "cell"],
  // labels
  ["name", "title", "label", "display"],
  ["description", "desc", "details", "notes", "summary"],
  // status / category
  ["status", "state", "stage", "phase"],
  ["category", "type", "kind", "group", "tag"],
  // geography
  ["country", "nation", "region"],
  ["city", "town", "locality"],
  ["address", "street", "location"],
  ["zip", "postal", "postcode"],
  // analytics
  ["impressions", "views", "shows"],
  ["clicks", "taps"],
  ["conversion", "convert", "completion"],
];

/** Token -> canonical token (the first entry of its group). */
const CANONICAL: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const group of SYNONYM_GROUPS) {
    const canonical = group[0]!;
    for (const word of group) m.set(word.toLowerCase(), canonical);
  }
  return m;
})();

export function canonicalize(token: string): string {
  return CANONICAL.get(token.toLowerCase()) ?? token.toLowerCase();
}
