-- Invite codes table — beta access control
CREATE TABLE IF NOT EXISTS invite_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  used_by    text NULL,        -- email of the user who redeemed it
  used_at    timestamptz NULL,
  created_at timestamptz DEFAULT now()
);

-- All access goes through service role on the server — no client-side access needed
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Seed 20 beta invite codes
INSERT INTO invite_codes (code) VALUES
  ('CORTX-G246JD'),
  ('CORTX-PR4HHX'),
  ('CORTX-R8RKHW'),
  ('CORTX-J2P2XB'),
  ('CORTX-TBE3WM'),
  ('CORTX-UR542J'),
  ('CORTX-96B2WN'),
  ('CORTX-6Q72YD'),
  ('CORTX-3AA5BR'),
  ('CORTX-8E9HUV'),
  ('CORTX-7K6KFY'),
  ('CORTX-3ARED5'),
  ('CORTX-M6VB8U'),
  ('CORTX-KJD3YB'),
  ('CORTX-2W68VT'),
  ('CORTX-PNMY5B'),
  ('CORTX-TZNZ87'),
  ('CORTX-N9TG46'),
  ('CORTX-WP58MW'),
  ('CORTX-85XCV6')
ON CONFLICT (code) DO NOTHING;
