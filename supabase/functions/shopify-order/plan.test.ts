// Local check of plan.ts against the live products table (read-only).
// Run from the repo root:  node --env-file=.env supabase/functions/shopify-order/plan.test.ts
import { planOrder, customerName } from "./plan.ts";

const r = await fetch(process.env.SUPABASE_URL + "/rest/v1/products?select=id,name,color,series,sku,barcode,qty&order=name,color", {
  headers: { apikey: process.env.SUPABASE_KEY!, Authorization: "Bearer " + process.env.SUPABASE_KEY },
});
const products = await r.json();

let fails = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log((cond ? "PASS " : "FAIL ") + name);
  if (!cond) { fails++; console.log("   ", JSON.stringify(detail)); }
}

// Retail order: Green Pumpkin Craw x2 (with a $2 discount), apparel tee, unknown SKU.
const retail = planOrder({
  customer: { first_name: "Test", last_name: "Buyer" },
  line_items: [
    { sku: "850070815314", title: '4" Craw', name: '4" Craw - Green Pumpkin', quantity: 2, price: "6.99", discount_allocations: [{ amount: "2.00" }] },
    { sku: "PF-41095949417767653217", title: "Johnny's Block Font Tee", quantity: 1, price: "23.99" },
    { sku: "999999999999", title: "Mystery", quantity: 1, price: "1.00" },
  ],
}, products);
check("retail -> DTC", retail.channel === "DTC", retail.channel);
check("GP Craw -> pid 401, 2 bags", retail.items.length === 1 && retail.items[0].pid === 401 && retail.items[0].qty === 2, retail.items);
check("discounted price 5.99", retail.items[0]?.price === 5.99, retail.items[0]);
check("apparel + unknown skipped", retail.skipped.length === 2, retail.skipped);

// Wholesale: GP Neko (WS) x1 = 6 bags at $3.50; Walker (WS) x2 = 2 walkers.
const ws = planOrder({
  line_items: [
    { sku: "850070815178", title: '5" Neko (WS)', quantity: 1, price: "21.00" },
    { sku: "850070815383", title: "Johnny Creek Walker (WS)", quantity: 2, price: "12.99" },
  ],
}, products);
check("WS -> Dealer", ws.channel === "Dealer", ws.channel);
check("WS Neko = 6 bags of pid 301 at 3.50", ws.items[0]?.pid === 301 && ws.items[0].qty === 6 && ws.items[0].price === 3.5, ws.items[0]);
check("WS Walker = 2 units pid 1003", ws.items[1]?.pid === 1003 && ws.items[1].qty === 2, ws.items[1]);

// Variety Pack: never deducts pid 1201, deducts 7 component bags each.
const vp = planOrder({ line_items: [{ sku: "JCB-VAR7", title: "Variety Pack", quantity: 1, price: "43.93" }] }, products);
const comps = vp.items[0]?.components || [];
check("variety pack has 7 components", comps.length === 7, comps);
check("includes Ringo's Gift", comps.some((c) => c.color === "Ringo's Gift"), comps);
check("no deduction on 1201", vp.deductions.every((d) => d.pid !== 1201) && vp.deductions.length === 7, vp.deductions);
check("totalQty counts 7 bags", vp.totalQty === 7, vp.totalQty);
console.log("    picked:", comps.map((c) => `${c.name} ${c.color}`).join(", "));

check("ship paid 7.00", planOrder({ line_items: [], shipping_lines: [{ price: "7.00", discounted_price: "7.00" }] }, products).shipPaid === 7);
check("free-ship code -> 0", planOrder({ line_items: [], shipping_lines: [{ price: "7.00", discounted_price: "0.00" }] }, products).shipPaid === 0);
check("customer name fallback", customerName({ shipping_address: { name: "Ship Name" } }) === "Ship Name");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
