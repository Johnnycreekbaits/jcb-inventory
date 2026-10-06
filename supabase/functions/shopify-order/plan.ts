// Pure order-planning logic for the shopify-order Edge Function.
// No I/O here so it can be tested locally with `node plan.test.ts`.
// Mirrors confirmOrder() + openVarietyPackModal() in index.html.

export type Product = {
  id: number; name: string; color: string | null; series: string | null;
  sku: string | null; barcode: string | null; qty: number;
};

export type Component = { pid: number; name: string; color: string; qty: number };
export type OrderItem = {
  pid: number; name: string; color: string; qty: number; price: number;
  components?: Component[];
};
export type Skipped = { sku: string | null; title: string; qty: number; reason: string };
export type Plan = {
  channel: "DTC" | "Dealer";
  items: OrderItem[];
  skipped: Skipped[];
  deductions: { pid: number; qty: number; variety: boolean }[];
  totalQty: number; totalVal: number;
  shipPaid: number;
};

export const VARIETY_PID = 1201;
export const VARIETY_SKU = "JCB-VAR7";
export const WS_BAGS_PER_UNIT = 6;

const round2 = (n: number) => Math.round(n * 100) / 100;

// Same picks as openVarietyPackModal(): Ringo's Gift + top Nekos/Finesse Worms by stock.
// `products` must be sorted by name,color like the app loads them.
export function pickVarietyComponents(products: Product[]): Product[] | null {
  const rg = products.find((p) => p.color === "Ringo's Gift" && (p.series === "Finesse Worms" || p.series === "Nekos"));
  const byQty = (a: Product, b: Product) => b.qty - a.qty;
  let nekos = products.filter((p) => p.series === "Nekos" && (!rg || p.id !== rg.id)).sort(byQty).slice(0, 4);
  const rgWorm = rg && rg.series === "Finesse Worms";
  const worms = (rgWorm ? [rg!] : []).concat(
    products.filter((p) => p.series === "Finesse Worms" && (!rg || p.id !== rg.id)).sort(byQty).slice(0, rgWorm ? 2 : 3),
  );
  if (rg && rg.series === "Nekos") nekos = [rg].concat(nekos.slice(0, 3));
  if (nekos.length < 4 || worms.length < 3) return null;
  return nekos.concat(worms);
}

// Wholesale listings are titled "... (WS)" and reuse the retail UPC SKUs.
// A WS soft-plastic unit is a 6-bag pack; WS Walkers/Glides are single units.
function isWholesale(li: any): boolean {
  return /\(WS\)/i.test(li.title || "") || /\(WS\)/i.test(li.name || "");
}
function bagsPerUnit(prod: Product, ws: boolean): number {
  if (!ws) return 1;
  return /walker|xg8|glide/i.test(prod.name) ? 1 : WS_BAGS_PER_UNIT;
}

// Price actually paid per unit, after line-level discounts.
function paidUnitPrice(li: any): number {
  const qty = Number(li.quantity) || 1;
  const gross = Number(li.price) * qty;
  const disc = (li.discount_allocations || []).reduce((s: number, d: any) => s + Number(d.amount || 0), 0);
  return Math.max(0, gross - disc) / qty;
}

export function planOrder(order: any, products: Product[]): Plan {
  const byBarcode = new Map<string, Product>();
  for (const p of products) if (p.barcode) byBarcode.set(String(p.barcode).trim(), p);

  const items: OrderItem[] = [];
  const skipped: Skipped[] = [];
  const deductions: Plan["deductions"] = [];
  let anyWs = false;

  for (const li of order.line_items || []) {
    const sku = li.sku ? String(li.sku).trim() : null;
    const title = li.name || li.title || "";
    const qty = Number(li.quantity) || 0;
    if (qty <= 0) continue;

    if (sku === VARIETY_SKU || (!sku && /variety pack/i.test(li.title || ""))) {
      const comps = pickVarietyComponents(products);
      if (!comps) { skipped.push({ sku, title, qty, reason: "not enough Neko/Finesse SKUs for Variety Pack" }); continue; }
      items.push({
        pid: VARIETY_PID, name: "Variety Pack", color: "", qty, price: round2(paidUnitPrice(li)),
        components: comps.map((p) => ({ pid: p.id, name: p.name, color: p.color || "", qty: 1 })),
      });
      for (const p of comps) deductions.push({ pid: p.id, qty, variety: true });
      continue;
    }

    if (!sku) { skipped.push({ sku, title, qty, reason: "no SKU" }); continue; }
    if (sku.startsWith("PF-")) { skipped.push({ sku, title, qty, reason: "Printify apparel" }); continue; }
    const prod = byBarcode.get(sku);
    if (!prod) { skipped.push({ sku, title, qty, reason: "SKU not found in products.barcode" }); continue; }

    const ws = isWholesale(li);
    if (ws) anyWs = true;
    const per = bagsPerUnit(prod, ws);
    const bags = qty * per;
    items.push({ pid: prod.id, name: prod.name, color: prod.color || "", qty: bags, price: round2(paidUnitPrice(li) / per) });
    deductions.push({ pid: prod.id, qty: bags, variety: false });
  }

  const totalQty = items.reduce((s, i) => s + (i.components ? i.components.length * i.qty : i.qty), 0);
  const totalVal = round2(items.reduce((s, i) => s + i.qty * i.price, 0));
  return { channel: anyWs ? "Dealer" : "DTC", items, skipped, deductions, totalQty, totalVal, shipPaid: shippingPaid(order) };
}

// What the customer paid for shipping, after shipping discounts (free-shipping codes etc.).
export function shippingPaid(order: any): number {
  return round2((order.shipping_lines || []).reduce(
    (s: number, l: any) => s + Number(l.discounted_price ?? l.price ?? 0), 0));
}

export function customerName(order: any): string {
  const c = order.customer || {};
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return full || order.shipping_address?.name || order.billing_address?.name || order.email || "Shopify customer";
}
