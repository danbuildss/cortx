# Cori server (Phase D)

Cori's server is a small Hetzner VPS in its own **CORTX** project, separate from Luca. Cori runs there as one process (`systemd`), under its own user. It holds **no wallet key**, no Supabase service-role key and no Telegram token. Its only secret is the `cori_agent` database password. Spec: [`docs/CORI_SCOUT_V0_SPEC.md`](../../docs/CORI_SCOUT_V0_SPEC.md) §15, §16, §24, §25.

| File | What it is |
|---|---|
| `setup.sh` | one-time server setup (run as root) |
| `deploy.sh` | deploy or roll back: fetch → install (no install scripts) → Cori tests → build → restart |
| `cori.service` | the Cori daemon (restart on failure, 512 MB / 50% CPU caps, hardened) |
| `cori-dryrun.service` | one read-only cycle: writes nothing but `dry:*` run rows |
| `cori.env.example` | template for `/etc/cori/cori.env` |

## Before you start

- Migration **027** has been run in Supabase (`discovery_listings` and `discovery_observations` exist).
- You have an SSH key on your computer (`~/.ssh/id_ed25519.pub`). If not: `ssh-keygen -t ed25519`.

## 1. Create the server (Hetzner console)

1. Use the existing **Default** project (next to the Luca server; a new project didn't offer CX23). Don't change the Luca server.
2. Add Server:
   - **Location:** nearest to your Supabase project's region. Supabase → Project Settings → General shows the region, e.g. `eu-central-1` → Falkenstein or Nuremberg; `us-east-1` → Ashburn.
   - **Image:** Ubuntu 24.04.
   - **Type:** CX23 (Cost-Optimized x86, 2 vCPU / 4 GB): the same as the Luca server.
   - **Networking:** keep **IPv4 and IPv6** on.
   - **SSH key:** add your public key.
   - **Name:** `cori`.
3. Note the server's IPv4 address.

## 2. Set up the server

```bash
ssh root@<server-ip>
curl -fsSLO https://raw.githubusercontent.com/danbuildss/cortx/main/ops/cori/setup.sh
less setup.sh          # read it; q to quit
bash setup.sh
```

At the end, **open a new terminal** and check that `ssh cortx@<server-ip>` works before you close the root session. Root login is now off.

## 3. The database password (only you see it)

1. Generate a long password of **letters and digits only** (30+ characters) in your password manager.
2. In the Supabase SQL editor run (with your password in place of `...`):
   ```sql
   alter role cori_agent with login password '...';
   ```
3. On the server, as `cortx`:
   ```bash
   sudo nano /etc/cori/cori.env
   ```
   Replace `PASSWORD` and `PROJECT_REF` in `CORI_DATABASE_URL`. `PROJECT_REF` is the id in your Supabase URL, `https://PROJECT_REF.supabase.co`. Save with Ctrl+O, Enter, Ctrl+X.

Never paste the password into chat, GitHub or anywhere else.

## 4. Build and dry run

```bash
sudo /opt/cori/app/ops/cori/deploy.sh
sudo systemctl start cori-dryrun          # takes a few minutes: reads the whole Bazaar
journalctl -u cori-dryrun -o cat | tail -20
```

What to look for:
- `"event":"started"` with `"cori_version"`.
- `"event":"cycle_done"` with `discovery.cdp_bazaar.items` around 16,000, few `invalid_items`, and no `source_errors`.
- `"event":"summary"`: counts per class and up to 10 sample candidates.

If the database connection fails with the direct URL (`ENETUNREACH`, a timeout), switch `CORI_DATABASE_URL` to the **session pooler** line in the env file and run the dry run again.

Send Claude the `cycle_done` and `summary` lines (they contain no secrets). If the live Bazaar fields differ from what the parser expects, Claude fixes the parser before going live.

## 5. Go live

```bash
sudo systemctl enable --now cori
journalctl -u cori -o cat -f              # Ctrl+C to stop watching; Cori keeps running
```

`/admin/cori` turns green within a few minutes, and candidates start arriving (at most 25 a day). The CORTX cron sends a Telegram alert if Cori goes quiet for 30 minutes.

## Everyday commands

| Task | Command |
|---|---|
| Status | `systemctl status cori` |
| Live logs | `journalctl -u cori -o cat -f` |
| Deploy the latest main | `sudo /opt/cori/app/ops/cori/deploy.sh` |
| Roll back to a commit | `sudo /opt/cori/app/ops/cori/deploy.sh <sha>` (history in `/opt/cori/DEPLOYS`) |
| Stop Cori | `sudo systemctl stop cori` (nothing public depends on it) |
| Cut Cori off from the database, no server needed | Supabase SQL: `alter role cori_agent nologin;` |
| Turn a source off | Supabase SQL: `update cori_sources set enabled = false where id = 'cdp_bazaar';` |

## Notes

- **Firewall** (`ufw`):
  - incoming: SSH only
  - outgoing: DNS, time, DHCP, 80 (Ubuntu package mirrors), 443, and Postgres 5432/6543
  - private, shared and link-local ranges (incl. the `169.254.169.254` metadata address) are refused first
  - Postgres isn't pinned to Supabase's IPs, because they change. Cori's code only ever probes port 443, so it can't use those ports as probe targets.
- **Code:** the repo is public and cloned read-only over HTTPS. The server never gets push access.
- **Dependencies:** `deploy.sh` installs with `--ignore-scripts`, so no package runs code at install time. Then it runs Cori's tests, including the check that the bundle has no payment code, and only then builds and restarts.
- **Hetzner console:** if the firewall or SSH settings ever lock you out, the web console in the Hetzner dashboard still works.
