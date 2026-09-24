# JCBData — Claude Context

Johnny Creek Baits inventory + finance apps. This file is the durable memory for Claude
across sessions — **keep it current** (see "Session Log Rule" below).

> ⚠️ This repo is PUBLIC. Never put credentials, passwords, COGS/margins, or investor
> details in this file. Those go in `CLAUDE.local.md` (gitignored, auto-loaded by Claude).

## Apps
All pages are single-file HTML/CSS/JS — no build step, no framework, no npm. Keep it that way.

| File | Purpose | Live URL |
|---|---|---|
| `index.html` | Inventory app — tabs: Stock, Checkout, Labels, Reports, History, Import, Export | https://johnnycreekbaits.github.io/jcb-inventory/ |
| `profit.html` | Finance app (password-gated, owner/investor portal) — tabs: Dashboard, Production, P&L, Expenses, Costs, Report | https://johnnycreekbaits.github.io/jcb-inventory/profit.html |
| `production-schedule.html` | Printable production schedule (not yet committed) | — |

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
- `history` — audit log (JS var is `auditLog`, to avoid clashing with `window.history`)
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
  return-order `[data-ret]` handler (`retInFlight` Set + confirm prompt) all have one.
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
