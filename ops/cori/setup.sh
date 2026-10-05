#!/usr/bin/env bash
# One-time setup of the Cori server (Hetzner, Ubuntu 24.04). Run as root:
#
#   curl -fsSLO https://raw.githubusercontent.com/danbuildss/cortx/main/ops/cori/setup.sh
#   less setup.sh            # read it first
#   bash setup.sh
#
# What it does (docs/CORI_SCOUT_V0_SPEC.md §15, §16, §24):
#   - updates the system, turns on automatic security updates and fail2ban
#   - creates an admin user `cortx` (sudo, your SSH key), then turns off root
#     and password SSH logins
#   - firewall: no incoming except SSH; outgoing only DNS, time, web (80/443)
#     and Postgres (5432/6543); private and link-local ranges (incl. the cloud
#     metadata address) are refused outright
#   - installs Node 22 from nodejs.org (checksum verified)
#   - creates the `cori` system user (no shell, no sudo), clones the public
#     repo read-only to /opt/cori/app, installs the systemd units (not started)
#   - creates /etc/cori/cori.env (root-only) from the template — you add the
#     database password yourself
# Safe to re-run. Holds no secrets. Cori never gets a wallet key.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/danbuildss/cortx.git}"
ADMIN_USER="${ADMIN_USER:-cortx}"

[ "$(id -u)" -eq 0 ] || { echo "Run as root"; exit 1; }
. /etc/os-release
[ "${ID:-}" = "ubuntu" ] || echo "WARNING: written for Ubuntu 24.04, this is ${PRETTY_NAME:-unknown}"

step() { printf '\n==> %s\n' "$*"; }

step "System update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install ufw fail2ban unattended-upgrades git curl ca-certificates xz-utils openssl
dpkg-reconfigure -f noninteractive unattended-upgrades
systemctl enable --now fail2ban

step "Admin user '$ADMIN_USER' (sudo, same SSH key as root)"
if [ ! -s /root/.ssh/authorized_keys ]; then
  echo "No SSH key in /root/.ssh/authorized_keys — add your key in the Hetzner console first. Stopping."
  exit 1
fi
if ! id "$ADMIN_USER" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$ADMIN_USER"
fi
usermod -aG sudo "$ADMIN_USER"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
install -m 600 -o "$ADMIN_USER" -g "$ADMIN_USER" /root/.ssh/authorized_keys "/home/$ADMIN_USER/.ssh/authorized_keys"
# Key-only login means no password prompt; let the admin use sudo without one
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$ADMIN_USER"
chmod 440 "/etc/sudoers.d/90-$ADMIN_USER"
visudo -cq

step "SSH: keys only, no root login"
# 01- so it's read before cloud-init's 50-cloud-init.conf (sshd keeps the first value it sees)
cat > /etc/ssh/sshd_config.d/01-cori.conf <<'CONF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
CONF
sshd -t
systemctl reload-or-restart ssh

step "Firewall"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default deny outgoing
ufw limit in 22/tcp comment 'SSH'
# DHCP first: Hetzner's gateway (172.31.1.1) is in a private range denied below
ufw allow out 67/udp comment 'DHCP'
# Never to private, shared or link-local ranges (incl. 169.254.169.254 metadata).
# Inserted first so they win over the allow rules below.
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16 fc00::/7 fe80::/10; do
  ufw deny out to "$net" comment 'private/link-local'
done
ufw allow out 53 comment 'DNS'
ufw allow out 123/udp comment 'time'
ufw allow out 443/tcp comment 'HTTPS (Bazaar, probes, nodejs.org, GitHub)'
ufw allow out 80/tcp comment 'HTTP (Ubuntu package mirrors only; Cori itself is 443-only)'
# Supabase Postgres: direct (5432) or pooler (5432/6543). Not pinned to IPs —
# Supabase addresses change; Cori's code can't send probes to these ports.
ufw allow out 5432/tcp comment 'Supabase Postgres'
ufw allow out 6543/tcp comment 'Supabase pooler'
ufw --force enable

step "Logs: cap journald at 500 MB"
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\n' > /etc/systemd/journald.conf.d/cori.conf
systemctl restart systemd-journald

step "Node 22 (official build, checksum verified)"
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64) NODE_ARCH=arm64 ;;
  *) echo "Unsupported architecture $(uname -m)"; exit 1 ;;
esac
TMP="$(mktemp -d)"
curl -fsSL "https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt" -o "$TMP/SHASUMS256.txt"
NODE_TAR="$(grep -oE "node-v22\.[0-9]+\.[0-9]+-linux-${NODE_ARCH}\.tar\.xz" "$TMP/SHASUMS256.txt" | head -1)"
[ -n "$NODE_TAR" ] || { echo "Could not find a Node 22 build for $NODE_ARCH"; exit 1; }
NODE_VER="${NODE_TAR#node-}"; NODE_VER="${NODE_VER%%-linux-*}"
if [ "$(/usr/local/bin/node --version 2>/dev/null || true)" != "$NODE_VER" ]; then
  curl -fsSL "https://nodejs.org/dist/latest-v22.x/$NODE_TAR" -o "$TMP/$NODE_TAR"
  (cd "$TMP" && grep " $NODE_TAR\$" SHASUMS256.txt | sha256sum -c -)
  tar -xJf "$TMP/$NODE_TAR" -C /usr/local --strip-components=1 --no-same-owner
fi
rm -rf "$TMP"
node --version

step "User 'cori' and the code"
if ! id cori >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /opt/cori --shell /usr/sbin/nologin cori
fi
chmod 750 /opt/cori
if [ ! -d /opt/cori/app/.git ]; then
  sudo -u cori git clone --quiet "$REPO_URL" /opt/cori/app
fi

step "Config: /etc/cori/cori.env (root-only)"
install -d -m 700 /etc/cori
if [ ! -f /etc/cori/cori.env ]; then
  install -m 600 /opt/cori/app/ops/cori/cori.env.example /etc/cori/cori.env
  echo "Created /etc/cori/cori.env from the template — add the database URL (see README)."
else
  echo "/etc/cori/cori.env exists — left unchanged."
fi

step "systemd units (installed, not started)"
install -m 644 /opt/cori/app/ops/cori/cori.service /etc/systemd/system/cori.service
install -m 644 /opt/cori/app/ops/cori/cori-dryrun.service /etc/systemd/system/cori-dryrun.service
systemctl daemon-reload

cat <<NEXT

Setup done. Next (ops/cori/README.md):
  1. In a NEW terminal, check you can log in:  ssh $ADMIN_USER@<server-ip>
     (root login is now off — keep this session open until that works)
  2. sudo nano /etc/cori/cori.env      → paste the cori_agent database URL
  3. sudo /opt/cori/app/ops/cori/deploy.sh
  4. sudo systemctl start cori-dryrun && journalctl -u cori-dryrun -o cat
NEXT
