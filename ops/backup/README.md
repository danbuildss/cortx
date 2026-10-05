# CORTX database backup (DATA COMPOUNDS S2)

Weekly, encrypted, off-platform copy of CORTX's evidence (`checks`, `incidents`,
`services`, `service_config_history`, Cori's tables, …). See `docs/DATA_COMPOUNDS.md`.

**Design:** a GitHub Action in a **private** repo runs `pg_dump` of the `public`
schema, encrypts the file with [age](https://age-encryption.org) using *your*
public key, and stores it as a GitHub release. The private key never leaves your
own machine — nobody else (including GitHub) can read the backups.

What's not included: Supabase's `auth` schema (login data, password hashes). It
stays only in Supabase; the evidence is what this protects.

## One-time setup (≈15 minutes, on your PC)

1. **Make your key pair** (install age: `brew install age`, `apt install age`, or the
   Windows release from github.com/FiloSottile/age/releases):
   ```bash
   age-keygen -o cortx-backup-key.txt
   ```
   It prints `Public key: age1…`. Keep `cortx-backup-key.txt` **offline** (password
   manager / encrypted drive). Lose it and the backups can't be opened.
2. **Create a private repo**, e.g. `danbuildss/cortx-backups`.
3. **Add two secrets** there (Settings → Secrets and variables → Actions):
   - `CORTX_DATABASE_URL` — Supabase → Project Settings → Database → Connection
     string → **Session pooler** (GitHub's runners need IPv4), with your DB password.
   - `CORTX_BACKUP_AGE_PUBLIC_KEY` — the `age1…` public key.
   Never paste either into chat.
4. **Add the workflow:** copy `ops/backup/backup.yml` to
   `.github/workflows/backup.yml` in the private repo.
5. **Run it once:** Actions → *CORTX database backup* → *Run workflow*. A release
   `backup-YYYY-MM-DD` with one `.dump.age` file should appear.

## Restore (or just check a backup opens)

```bash
age -d -i cortx-backup-key.txt -o cortx.dump cortx-2026-10-12.dump.age
pg_restore --list cortx.dump | head          # see what's inside
pg_restore --no-owner -d "$TARGET_DATABASE_URL" cortx.dump   # into an empty database
```

Do a test restore into a scratch database once a quarter — a backup you've never
opened isn't a backup yet.

## Trade-off to know

The database password sits in that private repo's encrypted GitHub secrets. If
you'd rather not have it outside Supabase, the alternative is Supabase's paid plan
(daily backups, on-platform) — but then there's no copy outside Supabase.
