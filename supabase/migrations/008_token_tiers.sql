-- Add $CORTX token tier columns to profiles
alter table public.profiles
  add column if not exists cortx_wallet_address   text,
  add column if not exists cortx_token_balance    numeric  not null default 0,
  add column if not exists cortx_tier             text     not null default 'free'
    check (cortx_tier in ('free','tier1','tier2','tier3','tier4')),
  add column if not exists is_admin               boolean  not null default false,
  add column if not exists cortx_balance_synced_at timestamptz;

-- Mark the known admin account
update public.profiles
  set is_admin = true
  where id = 'e9374851-ac6f-4f1e-a131-6747fc37184a';
