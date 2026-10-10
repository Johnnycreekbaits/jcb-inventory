# JCBData — Claude Context

Johnny Creek Baits inventory + finance apps. This file is the durable memory for Claude
across sessions — **keep it current** (see "Session Log Rule" below).

> ⚠️ This repo is PUBLIC. Never put credentials, passwords, COGS/margins, or investor
> details in this file. Those go in `CLAUDE.local.md` (gitignored, auto-loaded by Claude).

## Apps
All pages are single-file HTML/CSS/JS — no build step, no framework, no npm. Keep it that way.

| File | Purpose | Live URL |
|---|---|---|
| `index.html` | Inventory app — tabs: Stock, Checkout, Returns, Labels, Reports, History, Import, Export | https://johnnycreekbaits.github.io/jcb-inventory/ |
| `profit.html` | Finance app (password-gated, owner/investor portal) — tabs: Dashboard, Sales by Product (id `prod`), P&L, Expenses, Costs, Transfers, Report | https://johnnycreekbaits.github.io/jcb-inventory/profit.html |

- **Repo:** https://github.com/Johnnycreekbaits/jcb-inventory
- **Deploy:** push to `main` → GitHub Pages rebuilds (~2 min). `.github/workflows/deploy.yml`
- **Linode VPS:** `173.255.221.37` also hosts a copy at http://173.255.221.37 (HTTP only) —
  prefer the GitHub Pages URL to avoid the "Not Secure" warning.
- **Credentials:** `.env` (never committed) — SSH, GitHub, Supabase keys.

## Supabase
Project `rgjnasxasmwzvywgkgdu` — https://supabase.com/dashboard/project/rgjnasxasmwzvywgkgdu

- `products` — SKUs (id, name, color, series, sku, barcode, price, pack, qty, min, loc)
- `logs` — checkout orders (id, name, pid, date, qty, price, ch, st, items, person, project, ret, paid)
  - `items` is JSON: new format `{state:"XX", items:[{pid,name,color,qty,price}]}`; old format is a plain array
  - `paid` = date string paid (null = unpaid) — drives AR in finance app
  - `ship_paid` / `ship_cost` = shipping charged to customer / label cost to us (numeric, null = not entered).
    Edited on the order detail modal; finance Dashboard has a Shipping card (not included in Net Profit).
- `history` — audit log (JS var is `auditLog`, to avoid clashing with `window.history`).
  `batch_id` (nullable) links a `production` row to the batch it was received from; `return_id` links a `return` row
  to its `returns` record.
- `returns` — every return (Returns tab): return_date, log_id (null = no order), order_name, person, channel,
  `items` jsonb `[{pid,name,color,qty,price,components?}]`, reason, note, restocked (false = damaged/written off),
  returned_by. SQL: `supabase/sql/2026-10-10_returns.sql`.
- `production_batches` — bags made by JCB Manufacturing (batch_date, product_id/name/color, qty, batch_no,
  made_by, note, entered_by, edited_by/edited_at). Logging a batch does NOT move stock; Receive Production does.
  Received per batch = sum of history (qty_after − qty_before) with that batch_id; open = qty − received.
- `transfer_pos` — intercompany POs JCB Manufacturing → Johnny Creek Baits, LLC (po_number, po_date, period_start/end,
  status Draft/Issued/Received/Paid, markup_pct, vendor/buyer name+address, terms, notes, `lines` jsonb
  `[{pid,name,color,series,qty,cost,price}]`, total, paid_date, created_by/updated_by). Schema + RLS in
  `supabase/sql/2026-10-10_intercompany_transfers.sql` (run manually in the SQL editor — the CLI token has no DB access).
- `expenses` — monthly expenses (month, category, amount, description, created_by)
- `cost_profiles` — COGS per product (id, name, series, unit, cogs); seeded on first load

## Backups
- `backup_supabase.py` exports all 5 tables (JSON + CSV) to
  `G:\My Drive\JCB Backups\Supabase\<YYYY-MM-DD_HHMM>\` (Google Drive desktop sync).
- Runs daily at 9pm via Windows Task Scheduler task **"JCB Supabase Backup"** (catches up
  if the PC was off). Manual run: double-click `Backup-Supabase.bat`.
- Needs `SUPABASE_URL` / `SUPABASE_KEY` in `.env`. Each folder has `_summary.json` with row counts.
- Restore: use the `.json` files — POST rows back via `/rest/v1/<table>` or import the CSV in
  the Supabase Table Editor. Always back up current state before restoring.

## Shopify → inventory (Edge Function `shopify-order`)
- Code: `supabase/functions/shopify-order/` (`index.ts` HTTP + writes, `plan.ts` pure logic, `plan.test.ts`
  local test: `node --env-file=.env supabase/functions/shopify-order/plan.test.ts`).
- URL: `https://rgjnasxasmwzvywgkgdu.supabase.co/functions/v1/shopify-order` — Shopify webhook "Order creation".
  `?dry=1` = plan only, no writes (logs a `DRY ...` line). Deployed with `--no-verify-jwt`; auth is the
  Shopify HMAC (`SHOPIFY_WEBHOOK_SECRET`, set in Supabase Edge Function secrets + `.env` for testing).
- Deploy: `npx supabase functions deploy shopify-order --project-ref rgjnasxasmwzvywgkgdu --no-verify-jwt --use-api`
  (needs `SUPABASE_ACCESS_TOKEN` in `.env`, Edge Functions read/write only).
- Matches Shopify variant SKU → `products.barcode` (Shopify SKUs are the real UPCs). "(WS)" listings = Dealer,
  6 bags per soft-plastic unit (Walkers/Glides 1). Variety Pack SKU `JCB-VAR7` → 7 component bags picked like
  the app. `PF-` (Printify apparel) and unknown SKUs are skipped and stored under `items.skipped`.
- Writes like `confirmOrder()`: next `ORD-####`, project "Shopify #1234", history `changed_by` "Shopify".
  `logs.id` = Shopify order id, so webhook retries hit a PK conflict and don't double-deduct.
  Test and cancelled orders are ignored. Stock floors at 0 (oversell logged).
- Barcode source of truth: Google Sheet "01 - 000 Baits w/ Barcodes". Shopify SKUs must match it.

## P&L PDF import (Edge Function `pnl-import`)
- Finance app Expenses tab -> "Upload P&L PDF". The accountant's monthly report is a ScanSnap scan (no text layer),
  so `supabase/functions/pnl-import/index.ts` sends it to Claude (`claude-opus-5-5`, structured output) and returns
  the CURR MO Operating/Other expense lines + the printed totals. Nothing is written server-side: the app shows the
  lines as the normal import preview (with a total-vs-report check) and saves via the existing Apply button.
- Secret `ANTHROPIC_API_KEY` (Supabase Edge Function secrets + `.env`); Console spend limit $10/mo. JWT verification
  on (called with the anon key). ~3-5 cents per PDF.

## Returns (index.html Returns tab)
- All returns go through this tab: Checkout's "Return" button opens it with the order preselected. "From an order"
  allows partial returns (per line, capped at what's still out); "No order" for stock taken out without one.
  Reason required; "Damaged / defective" unticks "Put back in stock" (recorded + history row with no qty change).
- Order flips to `st:"Returned"` (ret = return date) only when every line is fully back. Variety Pack lines restock
  their component bags. Return Log also lists pre-tab full returns (orders `Returned` with no `returns` row) as "legacy".
- Finance `calcOrder()` subtracts partial returns (`partialReturns` map from `returns` with log_id) on orders still
  "Out"; fully returned orders are excluded as before. Returns use `change_type:"return"`, so they never show as
  possible production on the Transfers tab. Don't restock with "+".

## Intercompany transfers
- Inventory app Stock tab: **Log Batch Made** (no stock change) + **Receive Production** (batch picker fills product +
  remaining qty, saves `history.batch_id`). "Recent batches" link → list with edit/delete. History filter has `production`.
- Finance **Transfers** tab (month picker): Produced (batches) vs Received (history `production` rows) per product, open
  batches (all months), "Other stock increases" (+ / add / positive adjustment / edit rows — possible unlogged production,
  NOT on the PO), the month's batches (editable), and POs.
- PO: prefilled from the period's received units; unit price = Costs-tab COGS × (1 + markup); markup defaults to the last
  PO's, else 15%; Bundles + Apparel skipped. Everything editable; "Re-price at markup", "Refresh qty from inventory",
  printable PO (same Save-as-PDF bar as the invoice). Default note "For resale — sales tax exempt (CDTFA-230 on file)".
- Finance app has no per-person login: it reuses `localStorage.jcb_user` (same origin as the inventory app) or asks once
  on the Transfers tab, for entered_by / updated_by.

## Channels & Pricing (index.html)
`["DTC","Dealer","Distro","Pro Staff","Sponsorship/Promo","Internal"]`
- Sponsorship/Promo, Internal, Sample/Promo → $0 revenue
- JC Walker: Dealer/Distro → $10.99
- Soft plastics (pack≥8, price≤$7.50): Dealer $3.50, Distro $2.80, Pro Staff $5.00
- Everything else: stored `item.price` from checkout

## Key Functions / Architecture
- `parseItems(raw)` — handles both `log.items` formats
- `matchCostProfile(prod)` — matches series first, then name substring
- `calcOrder(log, prods)` — uses stored item.price (not recalculated from channel)
- `getPeriodLogs()` — filters by local date string, excludes `st="Returned"`
- Finance auth: `localStorage.getItem("jcb_finance_auth")`
- Cost profiles load from Supabase non-blocking, localStorage fallback
- `adjInFlight` Set guards +/− stock buttons against double-fire
- **Rule:** any button that triggers a Supabase write chain needs a double-submit guard
  (disable + "Saving..."). `btnSaveOrder`, `confirmOrder()` (`orderInFlight`) and the
  return-order `[data-ret]` handler (`retInFlight` Set + confirm prompt) all have one; so do
  batch save/delete (`batchInFlight`), Receive Production, and Transfers batch/PO save/delete (`trInFlight`).
- Variety Pack order lines (pid 1201) carry a `components` array. Any code that moves stock
  for an order (checkout, return, edit) must adjust the component bags, never pid 1201.
- Variety Pack (Bundles): always Ringo's Gift + top Nekos/Finesse Worms by stock
- Bundles series excluded from inventory value

## Style
DM Sans + Bebas Neue. Brand: orange `#E8A023`, navy `#1B1E5F`, blue `#3878C8`
(older pages use `#f97316` orange). KPI tiles = big Bebas Neue number + colored border.

## Working Style
- Before any server change, state the exact command.
- Read `.env` for credentials rather than asking the user.
- After changes: commit with a clear message, push to `main` when the user approves.

## "Load" Command
When the user says **"Load"** / **"Load JCBData"**, do the following automatically:

1. **Read `.env`** — confirm SSH (`SSH_HOST`, `SSH_USER`, `SSH_PASS`) and GitHub values are present
2. **Fetch GitHub state:** open issues (`https://api.github.com/repos/Johnnycreekbaits/jcb-inventory/issues`)
   and recent commits (`git log --oneline -10`)
3. **Check the Linode server** (`173.255.221.37`) — SSH in and report:
   - Running services (`systemctl list-units --type=service --state=running`)
   - Disk/memory (`df -h`, `free -h`)
   - Deployed web content (`ls /var/www`, `ls /home`, `pm2 list` if available)
4. **Read the Session Log** below
5. **Summarize:** server vs. GitHub, open issues, open follow-ups, and the recommended next step

## Session Log Rule
At the end of any session that changes these apps or their data, append a dated entry
below (what changed, why, any data corrections, open follow-ups) and commit it along
with the code. Update the sections above if architecture changed.

## Session Log
- **2026-06 (build)** — Built both apps. Fixes C1–C5 (channel pricing, returns, revenue),
  I1–I13 (COGS profiles, date boundaries, sponsorship tracking, inventory value,
  shareholder report), N1–N4, N6–N9 (invoice print/PDF, Receive Production Run,
  Mark as Paid + AR, "All Time" period, persistent finance auth). Skipped N5, N11.
- **2026-06/07** — Invoice shows GS1 barcode; order modal scroll fix; Paid/Unpaid filters
  + clickable AR tile; checkout keyboard + product color reset fixes; Edit Order channel
  reset fix; dynamic Variety Pack; Bundles excluded from inventory value.
- **2026-08-11** — Fixed Edit Order double-submit (commit `da29121`). ORD-0040 had doubled
  restock (+36 vs +18) on 24 products (ids 101–106, 201–206, 301–306, 401–406);
  rolled back with `correction` history entries.
- **2026-09-24** — Rebuilt this file as the durable project memory; added
  `CLAUDE.local.md` for private business context.
- **2026-09-24** — Stock search fix: "Melon Purple Flake" wasn't found from desktop search.
  Search now matches each word separately in any order (`matchesSearch()`), also searches
  series, shows a "N more matches hidden by the <series/stock> filter — tap to show all"
  button when tabs hide results, escapes the search box value, and skips re-render during
  mobile keyboard composition. No fuzzy matching (typos like "flk" still return nothing).
- **2026-09-24** — Double-submit audit: added guards to Confirm Order and Return (Return
  also now asks for confirmation). Fixed Return and Edit Order moving stock on the Variety
  Pack bundle (pid 1201) instead of its 7 component bags. Verified no past data was
  affected (no history on 1201; ORD-0029, the only bundle order, never edited/returned).
- **2026-09-24** — Added daily Supabase backup to Google Drive (`backup_supabase.py`,
  scheduled task "JCB Supabase Backup", 9pm). First backup: products 104, logs 55,
  history 689, expenses 7, cost_profiles 15.
- **2026-10-02 → 10-06** — Shopify order → inventory automation. Audited barcodes (sheet vs app vs
  Shopify): fixed 11 Shopify Green Pumpkin SKUs (Stick/Neko/Craw/Hawg/Finesse, retail + WS + DEMO Neko —
  each had a neighbouring color's/product's UPC); swapped XG8 Custom (815505) / White Ghost (815550) in app;
  removed Blue/Orange Walker variant from Shopify; set Shopify Variety Pack SKU `JCB-VAR7`. Built + deployed
  Edge Function `shopify-order` (webhook in dry-run `?dry=1` first). Added `logs.ship_paid` / `ship_cost`
  columns, manual Shipping section on order detail (+ shipping line on invoice), finance Dashboard
  Shipping card; Checkout tab has Shipping charged / Our ship cost fields. Function ignores Shopify's
  "Send test notification" sample (#9999). **Webhook switched to live 2026-10-06** (no `?dry=1`).
  ORD-0060 was a duplicate of ORD-0059 (double-submit); Thomas returned it 2026-09-24 to restock.
  Open: verify the first live Shopify order; optional Shippo API for automatic label cost;
  refund/cancel webhook to restock.
- **2026-10-06** — P&L PDF import: Edge Function `pnl-import` + "Upload P&L PDF" on the finance Expenses tab;
  added "Rent" expense category. Tested on May and Sept 2026 reports (sums $2,987 / $8,835 vs printed $2,988 /
  $8,836 — whole-dollar rounding). Found May's saved "Shop Expense $497" came from the LAST YEAR column (May CURR MO
  = 0) — flagged to Thomas to delete. June–Sept expenses not yet entered.
- **2026-10-09** — Verified Shopify webhook live: ORD-0062–0066 (Shopify #1017–#1022) logged automatically.
  `shopify-order` now rounds `logs.price` to cents (ORD-0064 had stored 6.989999…; patched to 6.99). Decisions
  (Thomas): Shopify refunds/cancels are restocked by hand (no webhook); shipping cost stays manual by design
  (no Shippo API); June–Aug expenses parked for later. `.env` had plain-text Klaviyo backup codes
  that broke `npx supabase functions deploy`; Thomas moved them out 2026-10-10. Keep `.env` KEY=VALUE only.
  Deleted untracked `production-schedule.html` (stale June 30 snapshot). Closed Cloudflare bot PRs #5, #7.
- **2026-10-10** — Intercompany transfer system (JCB Manufacturing → Johnny Creek Baits, LLC): new tables
  `production_batches`, `transfer_pos`, `history.batch_id` (SQL in `supabase/sql/`, run by Thomas in the SQL editor).
  Inventory app: Log Batch Made, batch list (edit/delete), batch picker on Receive Production, `production` + `+`
  History filters. Finance app: Transfers tab + editable intercompany POs with printable PDF. Nightly backup now
  includes the two new tables. Tested end-to-end in headless Chromium against live Supabase with sample rows
  (user "Claude Test", batch TEST-001, PO TEST-PO-1) — 31/31 checks; all sample rows deleted and the test product's
  stock restored. Note: most past production went in via `+` taps (278 `+` vs 1 `production` row), so expect those to
  show under "Other stock increases" until the team switches to Log Batch + Receive Production.
  Open: fill in real vendor/buyer addresses on the first PO (they carry forward to later POs).
- **2026-10-10** — Returns tab (inventory app): from-an-order (partial) or no-order returns with reason/note/date/
  restock flag, Return Log (+ legacy full returns, CSV export), Checkout "Return" button now routes here, "N returned"
  badge on partially returned orders. New `returns` table + `history.return_id` (SQL run by Thomas). Finance revenue/
  COGS net out partial returns. Nightly backup includes `returns`. Tested 18/18 against live Supabase with a sample
  order (TEST-ORD-1); all sample rows removed and stock restored.
- **2026-10-10** — Finance "Production" tab renamed **Sales by Product** (it always showed units sold/distributed per
  product type, never production). Now net of partial returns via shared `returnNetter(log)` (also used by
  `calcOrder`), and each card shows "N made this period" from `production_batches` (same cost-profile keying).
