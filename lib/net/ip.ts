import ipaddr from 'ipaddr.js';

// Ports we never connect to, even on public hosts (SSH, mail, databases).
export const BLOCKED_PORTS = new Set([22, 25, 465, 587, 3306, 5432, 6379, 27017]);

// True unless the address is a normal public unicast address. Allow-list, not
// block-list: anything ipaddr.js doesn't classify as `unicast` (private,
// loopback, link-local, reserved, multicast, 6to4, teredo, …) is refused.
// IPv4-mapped IPv6 (::ffff:10.0.0.1) is unwrapped and checked as IPv4.
export function isPrivateIP(address: string): boolean {
  try {
    let ip = ipaddr.parse(address);
    if (ip.kind() === 'ipv6' && (ip as ipaddr.IPv6).isIPv4MappedAddress()) {
      ip = (ip as ipaddr.IPv6).toIPv4Address();
    }
    return ip.range() !== 'unicast';
  } catch {
    // Unparseable → treat as blocked
    return true;
  }
}
