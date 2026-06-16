import * as dns from 'dns/promises';

/**
 * Checks whether an IP address belongs to a private, loopback, or cloud-metadata block.
 *
 * Covered ranges:
 * - 10.0.0.0/8 (Private)
 * - 172.16.0.0/12 (Private)
 * - 192.168.0.0/16 (Private)
 * - 127.0.0.0/8 (Loopback)
 * - 169.254.0.0/16 (Link-local/Cloud Metadata)
 * - 0.0.0.0/8 (Current network/Broadcast)
 * - ::1/128 (IPv6 Loopback)
 * - fc00::/7 (IPv6 Unique Local Addresses)
 * - fe80::/10 (IPv6 Link-local)
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 regex parsing
  const ipv4Match = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const parts = [
      parseInt(ipv4Match[1], 10),
      parseInt(ipv4Match[2], 10),
      parseInt(ipv4Match[3], 10),
      parseInt(ipv4Match[4], 10),
    ];

    if (
      parts[0] === 10 || // 10.0.0.0/8
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
      (parts[0] === 192 && parts[1] === 168) || // 192.168.0.0/16
      parts[0] === 127 || // 127.0.0.0/8
      (parts[0] === 169 && parts[1] === 254) || // 169.254.0.0/16
      parts[0] === 0 // 0.0.0.0/8
    ) {
      return true;
    }
  }

  // Basic IPv6 checks
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') {
    return true; // IPv6 loopback
  }
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) {
    return true; // Unique local address
  }
  if (ip.toLowerCase().startsWith('fe8') || ip.toLowerCase().startsWith('fe9') || ip.toLowerCase().startsWith('fea') || ip.toLowerCase().startsWith('feb')) {
    return true; // Link local address
  }

  return false;
}

/**
 * Resolves a hostname to all IPv4 and IPv6 addresses using direct DNS queries.
 * Uses dns.resolve4 and dns.resolve6 (bypasses the system nsswitch.conf/hosts cache)
 * to defend against DNS rebinding attacks where /etc/hosts or nsswitch.conf could
 * cause dns.lookup() to return a different result than the actual DNS record.
 */
async function resolveHostDirectly(hostname: string): Promise<string[]> {
  const addresses: string[] = [];
  try {
    const aRecords = await dns.resolve4(hostname);
    addresses.push(...aRecords);
  } catch {
    // No A records — not an error
  }
  try {
    const aaaaRecords = await dns.resolve6(hostname);
    addresses.push(...aaaaRecords);
  } catch {
    // No AAAA records — not an error
  }
  return addresses;
}

/**
 * Result of URL validation including the resolved public IP for safe fetches.
 */
export interface UrlValidationResult {
  safe: boolean;
  /** The resolved public IP address, present when safe is true */
  ip?: string;
}

/**
 * Validates a URL by performing direct DNS resolution and checking the resolved IP
 * against private/reserved ranges. Returns the validated public IP so callers can
 * use it directly instead of re-resolving the hostname later (which closes the
 * DNS rebinding window).
 *
 * Defends against Server-Side Request Forgery (SSRF) and DNS rebinding attacks.
 *
 * @param urlString The full URL to check.
 * @returns An object with { safe: boolean, ip?: string }.
 *   When safe is true, ip contains the validated public IP address.
 */
export async function validateSafeUrl(urlString: string): Promise<UrlValidationResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { safe: false }; // Invalid URL
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { safe: false };
  }

  const hostname = parsedUrl.hostname;

  try {
    // Use direct DNS resolution to bypass system resolver cache
    // (dns.lookup() respects /etc/hosts and nsswitch.conf, which can be
    // manipulated to cause dns.lookup() to return a different IP than the
    // actual DNS A/AAAA record — enabling DNS rebinding attacks)
    const addresses = await resolveHostDirectly(hostname);

    if (addresses.length === 0) {
      // No DNS records — hostname does not resolve; treat as unsafe
      return { safe: false };
    }

    // Check all resolved IPs
    for (const address of addresses) {
      if (isPrivateIP(address)) {
        return { safe: false };
      }
    }

    // Return the first resolved public IP for use in actual requests
    return { safe: true, ip: addresses[0] };
  } catch (error) {
    // DNS resolution failure — treat as unsafe
    return { safe: false };
  }
}