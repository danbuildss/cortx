#!/usr/bin/env bash
# Deploy (or roll back) Cori on its server. Run as the admin user with sudo:
#
#   sudo /opt/cori/app/ops/cori/deploy.sh               # latest main
#   sudo /opt/cori/app/ops/cori/deploy.sh <git-sha>     # a specific commit (rollback)
#
# Fetches the code, installs dependencies without running install scripts,
# runs Cori's tests, builds the one-file bundle (stamped with the commit), then
# restarts Cori if it's enabled. A failed test or build leaves the running
# version untouched.
set -euo pipefail

REF="${1:-origin/main}"
APP=/opt/cori/app
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo"; exit 1; }
as_cori() { sudo -u cori -H env HOME=/opt/cori PATH=/usr/local/bin:/usr/bin:/bin "$@"; }

echo "==> Fetching $REF"
as_cori git -C "$APP" fetch --quiet origin
as_cori git -C "$APP" checkout --quiet --detach "$REF"
SHA="$(as_cori git -C "$APP" rev-parse --short=12 HEAD)"
echo "    at $SHA"

echo "==> Dependencies (no install scripts)"
(cd "$APP" && as_cori npm ci --ignore-scripts --no-audit --no-fund --loglevel=error)

echo "==> Cori tests"
(cd "$APP" && as_cori npm run -s test:cori >/tmp/cori-test.log 2>&1) || {
  tail -40 /tmp/cori-test.log; echo "Tests failed — nothing deployed."; exit 1;
}
grep -E '^# (pass|fail)' /tmp/cori-test.log

echo "==> Build"
(cd "$APP" && as_cori npm run -s build:cori)

echo "==> systemd units"
install -m 644 "$APP/ops/cori/cori.service" /etc/systemd/system/cori.service
install -m 644 "$APP/ops/cori/cori-dryrun.service" /etc/systemd/system/cori-dryrun.service
systemctl daemon-reload

echo "$SHA $(date -u +%FT%TZ)" >> /opt/cori/DEPLOYS
if systemctl is-enabled --quiet cori; then
  systemctl restart cori
  sleep 3
  systemctl --no-pager --lines=5 status cori || true
  echo "Deployed $SHA and restarted Cori."
else
  echo "Built $SHA. Cori isn't enabled yet (go live with: sudo systemctl enable --now cori)."
fi
