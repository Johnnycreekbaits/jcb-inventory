"""Back up every JCB Supabase table to Google Drive as JSON + CSV.

Run:  python backup_supabase.py        (or double-click Backup-Supabase.bat)
Output: G:\\My Drive\\JCB Backups\\Supabase\\<YYYY-MM-DD_HHMM>\\<table>.json / .csv
Reads SUPABASE_URL / SUPABASE_KEY from .env next to this file.
"""
import csv
import json
import os
import sys
import urllib.request
from datetime import datetime

TABLES = ["products", "logs", "history", "expenses", "cost_profiles", "production_batches", "transfer_pos"]
BACKUP_ROOT = r"G:\My Drive\JCB Backups\Supabase"
PAGE = 1000
HERE = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env = {}
    with open(os.path.join(HERE, ".env"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
    return env


def fetch_table(url, key, table):
    rows, start = [], 0
    while True:
        req = urllib.request.Request(
            f"{url}/rest/v1/{table}?select=*&order=id",
            headers={"apikey": key, "Authorization": f"Bearer {key}",
                     "Range": f"{start}-{start + PAGE - 1}"},
        )
        with urllib.request.urlopen(req, timeout=60) as r:
            page = json.load(r)
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        start += PAGE


def write_csv(path, rows):
    cols = []
    for r in rows:
        cols.extend(k for k in r if k not in cols)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in r.items()})


def main():
    env = load_env()
    url, key = env["SUPABASE_URL"], env["SUPABASE_KEY"]
    if not os.path.isdir("G:\\My Drive"):
        sys.exit("Google Drive (G:\\My Drive) not found - is Google Drive for desktop running?")
    out = os.path.join(BACKUP_ROOT, datetime.now().strftime("%Y-%m-%d_%H%M"))
    os.makedirs(out, exist_ok=True)
    summary = {}
    for t in TABLES:
        rows = fetch_table(url, key, t)
        with open(os.path.join(out, f"{t}.json"), "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=1, ensure_ascii=False)
        write_csv(os.path.join(out, f"{t}.csv"), rows)
        summary[t] = len(rows)
        print(f"  {t:<18} {len(rows):>5} rows")
    with open(os.path.join(out, "_summary.json"), "w", encoding="utf-8") as f:
        json.dump({"backed_up_at": datetime.now().isoformat(timespec="seconds"), "rows": summary}, f, indent=1)
    print(f"Backup saved to {out}")


if __name__ == "__main__":
    main()
