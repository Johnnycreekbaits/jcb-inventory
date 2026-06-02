# JCBData — Claude Context

## Project: Johnny Creek Baits Inventory App
A self-contained single-file inventory management app (`index.html`) for Johnny Creek Baits.
- **Repo:** https://github.com/Johnnycreekbaits/jcb-inventory
- **Stack:** Pure HTML/CSS/JS — no build step, no framework, no dependencies except Google Fonts
- **Hosting:** GitHub Pages (live from `main` branch) + Linode VPS (`173.255.221.37`)
- **Status:** Active — 2 open issues, last push today (2026-06-02), no README yet

## Credentials
All sensitive values live in `.env` (never committed):
- `SSH_HOST`, `SSH_USER`, `SSH_PASS` — Linode VPS access
- `GITHUB_REPO` — https://github.com/Johnnycreekbaits/jcb-inventory

## "Load" Command
When the user says **"Load"** or **"Load JCBData"**, do the following automatically:

1. **Read `.env`** — confirm SSH and GitHub values are present
2. **Fetch GitHub state:**
   - Check open issues: `https://api.github.com/repos/Johnnycreekbaits/jcb-inventory/issues`
   - List repo files: `https://api.github.com/repos/Johnnycreekbaits/jcb-inventory/contents`
   - Note: there is currently no README — the source of truth is `index.html`
3. **Check the server** — SSH in and report:
   - Running services (`systemctl list-units --type=service --state=running`)
   - Disk/memory (`df -h`, `free -h`)
   - Deployed web content (`ls /var/www`, `ls /home`, `pm2 list` if available)
4. **Summarize:** what's deployed on the server vs. what's in GitHub, open issues, and the recommended next step

## Working Style
- This is a single-file app — all edits go into `index.html`
- No build tools, no npm, no bundler — keep it that way unless explicitly asked to change
- Always reference `.env` for credentials rather than asking the user to re-type them
- Before any server change, state the exact command you'll run
- When adding features, keep styles consistent with existing DM Sans / Bebas Neue / orange (`#f97316`) brand
