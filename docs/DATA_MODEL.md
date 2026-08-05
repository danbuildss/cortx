# CORTX — Data Model

All tables live in Supabase Postgres. Row-level security is enabled on every table. Users can only access rows where `user_id = auth.uid()`.

---

## Table: `profiles`

Created automatically when a user signs up (via Supabase Auth trigger).

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | ✓ | — | FK → `auth.users.id` |
| `email` | `text` | ✓ | — | Copied from auth.users |
| `created_at` | `timestamptz` | ✓ | `now()` | |
| `updated_at` | `timestamptz` | ✓ | `now()` | |

**Relationships:** 1:many → `services`

**Indexes:**
- PK on `id`

**Sensitive fields:** `email`

**RLS:**
- `SELECT`: user can read their own row (`id = auth.uid()`)
- `INSERT`: trigger-only (not user-facing)
- `UPDATE`: user can update their own row

**Migration:**

```sql
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## Table: `services`

One row per registered x402 endpoint.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | ✓ | — | FK → `profiles.id` |
| `name` | `text` | ✓ | — | Display name |
| `endpoint_url` | `text` | ✓ | — | Full HTTPS URL |
| `environment` | `text` | ✓ | — | `'mainnet'` or `'testnet'` |
| `test_input` | `jsonb` | ✓ | — | Safe payload sent with each check |
| `expected_schema` | `jsonb` | ✓ | — | JSON Schema (AJV Draft-07) |
| `expected_price` | `numeric(18,8)` | ✓ | — | In USDC (or relevant unit) |
| `max_price` | `numeric(18,8)` | ✓ | — | Hard ceiling, enforced before payment |
| `latency_threshold_ms` | `integer` | ✓ | — | Latency limit in milliseconds |
| `check_interval_minutes` | `integer` | ✓ | — | Minimum: 5 |
| `telegram_chat_id` | `text` | ✓ | — | Alert destination |
| `status` | `text` | ✓ | `'unknown'` | `operational`, `degraded`, `critical`, `unknown` |
| `last_check_at` | `timestamptz` | — | `null` | Null until first check |
| `deleted_at` | `timestamptz` | — | `null` | Soft delete timestamp |
| `created_at` | `timestamptz` | ✓ | `now()` | |
| `updated_at` | `timestamptz` | ✓ | `now()` | |

**Relationships:**
- Many:1 → `profiles`
- 1:many → `checks`
- 1:many → `incidents`

**Indexes:**
- PK on `id`
- Index on `user_id`
- Index on `deleted_at` (for soft-delete filtering)
- Index on `last_check_at` (for scheduler queries)

**Sensitive fields:** `telegram_chat_id`, `test_input` (may contain auth tokens in payload)

**RLS:**
- All operations: `user_id = auth.uid()`
- Soft-deleted rows excluded from SELECT by default via view or application filter

**Migration:**

```sql
create table public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  endpoint_url text not null,
  environment text not null check (environment in ('mainnet', 'testnet')),
  test_input jsonb not null,
  expected_schema jsonb not null,
  expected_price numeric(18,8) not null check (expected_price > 0),
  max_price numeric(18,8) not null check (max_price >= expected_price),
  latency_threshold_ms integer not null check (latency_threshold_ms > 0),
  check_interval_minutes integer not null check (check_interval_minutes >= 5),
  telegram_chat_id text not null,
  status text not null default 'unknown'
    check (status in ('operational', 'degraded', 'critical', 'unknown')),
  last_check_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.services (user_id);
create index on public.services (deleted_at);
create index on public.services (last_check_at);

alter table public.services enable row level security;

create policy "Users manage own services"
  on public.services for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## Table: `checks`

One row per synthetic check execution.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | PK |
| `service_id` | `uuid` | ✓ | — | FK → `services.id` |
| `user_id` | `uuid` | ✓ | — | Denormalized for RLS |
| `started_at` | `timestamptz` | ✓ | — | Wall clock start |
| `completed_at` | `timestamptz` | — | `null` | Null if check errored mid-run |
| `latency_ms` | `integer` | — | `null` | Total wall clock latency |
| `status` | `text` | ✓ | — | `passed`, `failed`, `error` |
| `failure_stage` | `text` | — | `null` | Name of stage that failed |
| `stages` | `jsonb` | ✓ | — | Array of stage result objects (see below) |
| `observed_price` | `numeric(18,8)` | — | `null` | Price returned by endpoint |
| `error_message` | `text` | — | `null` | Top-level error if runner itself failed |
| `created_at` | `timestamptz` | ✓ | `now()` | |

**`stages` JSONB structure:**

```json
[
  {
    "stage": "availability",
    "passed": true,
    "duration_ms": 142,
    "evidence": {
      "http_status": 402,
      "response_headers": { "content-type": "application/json" }
    }
  },
  {
    "stage": "payment_terms",
    "passed": true,
    "duration_ms": 0,
    "evidence": {
      "payment_required": true,
      "accepts": ["USDC"],
      "network": "base"
    }
  },
  {
    "stage": "price_check",
    "passed": true,
    "duration_ms": 0,
    "evidence": {
      "expected_price": "0.01",
      "observed_price": "0.01",
      "max_price": "0.02"
    }
  },
  {
    "stage": "payment",
    "passed": true,
    "duration_ms": 1820,
    "evidence": {
      "tx_hash": "[REDACTED]",
      "amount_paid": "0.01"
    }
  },
  {
    "stage": "delivery",
    "passed": false,
    "duration_ms": 500,
    "evidence": {
      "http_status": 200,
      "body_received": false,
      "error": "Empty response body"
    }
  },
  {
    "stage": "json_parse",
    "passed": null,
    "duration_ms": null,
    "evidence": null
  },
  {
    "stage": "schema_validation",
    "passed": null,
    "duration_ms": null,
    "evidence": null
  }
]
```

**Relationships:** Many:1 → `services`

**Indexes:**
- PK on `id`
- Index on `service_id`
- Index on `user_id`
- Index on `(service_id, started_at DESC)` (check history queries)

**Sensitive fields:** `stages[*].evidence` may contain request/response bodies. Secrets are redacted before storage.

**RLS:** `user_id = auth.uid()`

**Migration:**

```sql
create table public.checks (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  completed_at timestamptz,
  latency_ms integer,
  status text not null check (status in ('passed', 'failed', 'error')),
  failure_stage text,
  stages jsonb not null default '[]',
  observed_price numeric(18,8),
  error_message text,
  created_at timestamptz not null default now()
);

create index on public.checks (service_id);
create index on public.checks (user_id);
create index on public.checks (service_id, started_at desc);

alter table public.checks enable row level security;

create policy "Users view own checks"
  on public.checks for select
  using (auth.uid() = user_id);

-- Insert handled by service role (check runner), not user directly
create policy "Service role inserts checks"
  on public.checks for insert
  with check (true); -- restricted by service_role key at application level
```

---

## Table: `incidents`

One row per incident. At most one open incident per service at any time.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | PK |
| `service_id` | `uuid` | ✓ | — | FK → `services.id` |
| `user_id` | `uuid` | ✓ | — | Denormalized for RLS |
| `severity` | `text` | ✓ | — | `degraded`, `critical` |
| `status` | `text` | ✓ | `'open'` | `open`, `acknowledged`, `resolved` |
| `failure_stage` | `text` | ✓ | — | Stage that triggered the incident |
| `triggering_check_id` | `uuid` | ✓ | — | FK → `checks.id` |
| `opened_at` | `timestamptz` | ✓ | `now()` | |
| `acknowledged_at` | `timestamptz` | — | `null` | |
| `resolved_at` | `timestamptz` | — | `null` | |
| `resolution_type` | `text` | — | `null` | `auto`, `manual` |
| `timeline` | `jsonb` | ✓ | `'[]'` | Array of timeline events |
| `created_at` | `timestamptz` | ✓ | `now()` | |
| `updated_at` | `timestamptz` | ✓ | `now()` | |

**`timeline` JSONB structure:**

```json
[
  { "event": "opened", "at": "2026-08-05T10:00:00Z", "actor": "system", "note": "Delivery failed (2 consecutive)" },
  { "event": "acknowledged", "at": "2026-08-05T10:05:00Z", "actor": "user" },
  { "event": "resolved", "at": "2026-08-05T10:30:00Z", "actor": "system", "note": "Check passed" }
]
```

**Relationships:**
- Many:1 → `services`
- Many:1 → `checks` (triggering check)

**Indexes:**
- PK on `id`
- Index on `service_id`
- Index on `user_id`
- Index on `(service_id, status)` (find open incidents for a service)

**Sensitive fields:** None

**RLS:** `user_id = auth.uid()`

**Migration:**

```sql
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  severity text not null check (severity in ('degraded', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  failure_stage text not null,
  triggering_check_id uuid not null references public.checks(id),
  opened_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_type text check (resolution_type in ('auto', 'manual')),
  timeline jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.incidents (service_id);
create index on public.incidents (user_id);
create index on public.incidents (service_id, status);

alter table public.incidents enable row level security;

create policy "Users manage own incidents"
  on public.incidents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## Table: `alert_destinations`

Reserved for future multi-channel alert support. In V1, alert config is stored directly on `services.telegram_chat_id`. This table is created now to avoid a migration later.

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | ✓ | `gen_random_uuid()` | PK |
| `service_id` | `uuid` | ✓ | — | FK → `services.id` |
| `user_id` | `uuid` | ✓ | — | Denormalized for RLS |
| `channel` | `text` | ✓ | — | `telegram` (only value in V1) |
| `destination` | `text` | ✓ | — | Telegram chat ID |
| `enabled` | `boolean` | ✓ | `true` | |
| `created_at` | `timestamptz` | ✓ | `now()` | |
| `updated_at` | `timestamptz` | ✓ | `now()` | |

**Migration:**

```sql
create table public.alert_destinations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'telegram' check (channel in ('telegram')),
  destination text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.alert_destinations (service_id);
create index on public.alert_destinations (user_id);

alter table public.alert_destinations enable row level security;

create policy "Users manage own alert destinations"
  on public.alert_destinations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```
