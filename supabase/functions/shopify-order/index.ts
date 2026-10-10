// Shopify "Order creation" webhook -> JCB inventory.
// Deducts sold bags from products.qty and records the sale in logs + history,
// the same way confirmOrder() in index.html does.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets, never in this repo):
//   SHOPIFY_WEBHOOK_SECRET   signing secret shown under Shopify Settings -> Notifications -> Webhooks
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically.
// Deploy with JWT verification off (Shopify can't send a Supabase JWT); the HMAC check is the auth.
// Add ?dry=1 to the URL to get the plan back without writing anything (HMAC still required).

import { planOrder, customerName, type Product } from "./plan.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET = Deno.env.get("SHOPIFY_WEBHOOK_SECRET") || "";
const HDR = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" };

async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, { ...init, headers: { ...HDR, ...(init.headers || {}) } });
  if (!r.ok) throw Object.assign(new Error(await r.text()), { status: r.status });
  return r.status === 204 || r.headers.get("content-length") === "0" ? null : r.json().catch(() => null);
}

async function validHmac(raw: string, header: string | null): Promise<boolean> {
  if (!SECRET || !header) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const expected = btoa(String.fromCharCode(...sig));
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const raw = await req.text();
  if (!(await validHmac(raw, req.headers.get("x-shopify-hmac-sha256")))) return json({ error: "bad signature" }, 401);

  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const order = JSON.parse(raw);
  const label = "Shopify " + (order.name || "#" + order.order_number);

  // Admin "Send test notification" posts a sample order (#9999, fixed id) that can contain real
  // products; Bogus-gateway test orders and cancelled orders shouldn't move real stock either.
  const sample = order.order_number === 9999 || order.name === "#9999" || String(order.id) === "820982911946154508" ||
    req.headers.get("x-shopify-test") === "true";
  const ignore = sample ? "test notification" : order.test ? "test order" : order.cancelled_at ? "cancelled" : "";
  if (ignore && !dry) {
    console.log(label, "ignored:", ignore);
    return json({ ok: true, ignored: ignore });
  }

  const products: Product[] = await db("products?select=id,name,color,series,sku,barcode,qty&order=name,color");
  const plan = planOrder(order, products);
  const person = customerName(order);
  if (plan.skipped.length) console.log(label, "skipped lines:", JSON.stringify(plan.skipped));
  if (dry) {
    const lines = plan.items.map((i) => i.components ? `${i.qty}x Variety Pack (${i.components.map((c) => c.color).join(", ")})` : `${i.qty}x ${i.name} ${i.color} @ $${i.price}`);
    console.log(`DRY ${label} | ${person} | ${plan.channel} | ${lines.join("; ")} | ship $${plan.shipPaid}` + (plan.skipped.length ? ` | skipped: ${plan.skipped.map((s) => s.title).join(", ")}` : "") +
      (ignore ? ` | LIVE WOULD IGNORE: ${ignore}` : ""));
    return json({ dry: true, label, person, ...plan });
  }
  if (!plan.items.length) return json({ ok: true, label, note: "no inventory items", skipped: plan.skipped });

  // Order number, same rule as confirmOrder(): next after the newest ORD-####.
  const recent: { name: string }[] = await db("logs?select=name&order=name.desc&limit=50");
  let last = 0;
  for (const l of recent) { const m = l.name && l.name.match(/^ORD-(\d+)$/); if (m) { last = parseInt(m[1], 10) || 0; break; } }
  const orderLabel = "ORD-" + String(last + 1).padStart(4, "0");

  // logs.id = Shopify order id, so a retried webhook hits a primary-key conflict instead of double-deducting.
  const state = order.shipping_address?.province_code || order.billing_address?.province_code || "";
  try {
    await db("logs", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: order.id, name: orderLabel, color: "", pid: plan.items[0].pid, qty: plan.totalQty,
        price: plan.totalQty > 0 ? Math.round((plan.totalVal / plan.totalQty) * 100) / 100 : 0, ch: plan.channel, person, project: label,
        date: String(order.created_at || new Date().toISOString()).slice(0, 10),
        items: JSON.stringify({ state, items: plan.items, ...(plan.skipped.length ? { skipped: plan.skipped } : {}) }),
        ret: null, st: "Out", ship_paid: plan.shipPaid,
      }),
    });
  } catch (e: any) {
    if (e.status === 409) { console.log(label, "already processed"); return json({ ok: true, label, duplicate: true }); }
    throw e;
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const shortfalls: string[] = [];
  for (const d of plan.deductions) {
    const prod = byId.get(d.pid);
    if (!prod) continue;
    const before = prod.qty;
    const after = Math.max(0, before - d.qty);
    if (before < d.qty) shortfalls.push(`${prod.name} ${prod.color || ""}: had ${before}, sold ${d.qty}`);
    prod.qty = after;
    await db("products?id=eq." + d.pid, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ qty: after }) });
    await db("history", {
      method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        id: Date.now() + Math.floor(Math.random() * 1000), product_id: prod.id, product_name: prod.name, color: prod.color || "",
        change_type: "checkout", qty_before: before, qty_after: after, changed_by: "Shopify",
        note: (d.variety ? "Variety Pack — " : "") + `Order for ${person} via ${plan.channel} - ${label}`,
      }),
    }).catch((e) => console.warn("history:", e.message));
  }
  if (shortfalls.length) console.warn(label, "oversold:", shortfalls.join("; "));

  console.log(label, "->", orderLabel, plan.channel, plan.totalQty, "bags");
  return json({ ok: true, label, order: orderLabel, channel: plan.channel, bags: plan.totalQty, skipped: plan.skipped, shortfalls });
});
