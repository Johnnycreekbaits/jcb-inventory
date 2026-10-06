// Monthly P&L PDF -> expense lines for the finance app's Expenses tab.
// The accountant's report is a ScanSnap scan (images only, no text layer), so Claude reads it.
// Nothing is written here: the app shows the lines as an import preview and saves them itself.
//
// Secret (Supabase dashboard -> Edge Functions -> Secrets): ANTHROPIC_API_KEY
// Called from profit.html with the project's anon key (JWT verification stays on).

import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const Pnl = z.object({
  is_income_statement: z.boolean(),
  month: z.string(), // "YYYY-MM" of the CURR MO period
  lines: z.array(z.object({
    printed_label: z.string(),
    category: z.string(),
    amount: z.number(),
  })),
  printed_total_operating: z.number(),
  printed_total_other: z.number(),
});

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { pdf?: string; categories?: string[] };
  try { body = await req.json(); } catch { return json({ error: "Send JSON: { pdf: <base64> }" }, 400); }
  const pdf = (body.pdf || "").replace(/^data:[^,]*,/, "").replace(/\s/g, "");
  if (!pdf) return json({ error: "No PDF received" }, 400);
  if (pdf.length * 0.75 > MAX_PDF_BYTES) return json({ error: "PDF is larger than 10 MB" }, 413);
  const categories = (body.categories || []).filter((c) => typeof c === "string").slice(0, 60);

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: zodOutputFormat(Pnl) },
    messages: [{
      role: "user",
      content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
        {
          type: "text",
          text: `This is a scanned monthly accounting report for Johnny Creek Baits (dot-matrix print; zeros are printed with a slash, Ø = 0).
It may contain a balance sheet and an income statement. Use only the INCOME STATEMENT pages.

Extract every line under OPERATING EXPENSES and OTHER EXPENSES, using only the CURR MO column (the first number column).
- A trailing minus means negative: "61-" is -61. Commas are thousands separators.
- Skip lines whose CURR MO value is 0. Skip TOTAL lines and NET PROFIT.
- printed_label: the label exactly as printed (it may be cut off, e.g. "OTHER TAXES, FEES, & LIC").
- category: the matching name from this list, copied exactly: ${JSON.stringify(categories)}.
  If nothing in the list fits, use the printed label in Title Case with small words lowercase (e.g. "Rent").
- printed_total_operating: the CURR MO value on the TOTAL OPERATING EXPENSES line.
- printed_total_other: the CURR MO value on the TOTAL OTHER EXPENSES line (0 if there is none).
- month: the report period as YYYY-MM, from "For The Period Of <Month> 1, <Year> ...".
- is_income_statement: false if there is no income statement in the document at all.`,
        },
      ],
    }],
  });

  if (response.stop_reason === "refusal") return json({ error: "The document could not be read (declined)." }, 422);
  const out = response.parsed_output;
  if (!out) return json({ error: "Could not read the report. Try a clearer scan, or paste the lines instead." }, 422);
  if (!out.is_income_statement) return json({ error: "No income statement found in this PDF." }, 422);

  const sum = Math.round(out.lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const printed = out.printed_total_operating + out.printed_total_other;
  console.log(`pnl-import ${out.month}: ${out.lines.length} lines, sum ${sum}, printed ${printed}`);
  // The report rounds each line to whole dollars, so a few dollars of difference is normal.
  return json({ month: out.month, lines: out.lines, sum, printed_total: printed, matches: Math.abs(sum - printed) <= 3 });
});
