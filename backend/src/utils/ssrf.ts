import dns from 'dns';
import net from 'net';
import { URL } from 'url';
import http from 'http';
import https from 'https';
import { AppError } from './errors';

export class SsrfError extends AppError {
  constructor(message: string, details?: unknown) {
    super('SSRF_ATTEMPT_DETECTED', message, 400, details, false);
    this.name = 'SsrfError';
  }
}

// Check if an IPv4 address is in a private, loopback, link-local or metadata range
export function isPrivateOrRestrictedIpV4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP is treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback addresses: localhost, 127.0.0.1, 127.x.x.x)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private Network)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private Network: 172.16.x.x to 172.31.x.x)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private Network)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET documentation)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast: 224.x.x.x - 239.x.x.x)
  if (a >= 224 && a <= 239) return true;

  // 240.0.0.0/4 (Reserved / Future Use)
  if (a >= 240) return true;

  // 255.255.255.255 (Broadcast)
  if (ip === '255.255.255.255') return true;

  return false;
}

// Check if an IPv6 address is in a private, loopback, or link-local range
export function isPrivateOrRestrictedIpV6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');

  // ::1 (IPv6 Loopback) or :: (Unspecified)
  if (normalized === '::1' || normalized === '::') return true;

  // IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (v4Part.includes('.')) {
      return isPrivateOrRestrictedIpV4(v4Part);
    }
    // Hexadecimal representation: e.g. 7f00:1 -> 127.0.0.1
    const hexSegments = v4Part.split(':');
    if (hexSegments.length === 2) {
      const high = parseInt(hexSegments[0], 16);
      const low = parseInt(hexSegments[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const a = (high >> 8) & 0xff;
        const b = high & 0xff;
        const c = (low >> 8) & 0xff;
        const d = low & 0xff;
        return isPrivateOrRestrictedIpV4(`${a}.${b}.${c}.${d}`);
      }
    }
    return true; // Malformed IPv4-mapped IPv6 is treated as unsafe
  }

  // fc00::/7 (Unique Local Address - ULA)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // fe80::/10 (Link-Local unicast)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true;
  }

  return false;
}

export function isPrivateOrRestrictedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '');
  if (clean.includes(':')) {
    return isPrivateOrRestrictedIpV6(clean);
  }
  return isPrivateOrRestrictedIpV4(clean);
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

export interface SafeFetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  buffer: Buffer;
  text: string;
  contentType: string;
}

/**
 * Validates a target URL against SSRF rules by resolving DNS and checking IPs.
 * Returns the resolved safe IP address and parsed URL.
 */
export async function validateUrlForSsrf(rawUrl: string): Promise<{ parsedUrl: URL; resolvedIp: string }> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL format: "${rawUrl}"`);
  }

  // Protocol check: only http and https are allowed
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SsrfError(`Blocked unsafe protocol: "${parsedUrl.protocol}". Only HTTP and HTTPS are permitted.`);
  }

  const rawHostname = parsedUrl.hostname.toLowerCase();
  const hostname = rawHostname.replace(/^\[|\]$/g, '');

  // Immediate localhost and local domain checks
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new SsrfError(`Access to local hostname "${hostname}" is blocked.`);
  }

  // Direct IP literal check (only when hostname is an IP literal)
  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrRestrictedIp(hostname)) {
      throw new SsrfError(`Direct access to private or restricted IP "${hostname}" is blocked.`);
    }
  }

  // DNS resolution check to prevent DNS rebinding
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      throw new SsrfError(`DNS resolution returned no addresses for "${hostname}"`);
    }

    for (const record of lookupResults) {
      if (isPrivateOrRestrictedIp(record.address)) {
        throw new SsrfError(
          `Host "${hostname}" resolved to restricted IP address "${record.address}". Connection blocked.`
        );
      }
    }

    // Return first resolved public IP for pinned connection
    return {
      parsedUrl,
      resolvedIp: lookupResults[0].address,
    };
  } catch (err: any) {
    if (err instanceof SsrfError) throw err;
    throw new SsrfError(`Failed to resolve host "${hostname}": ${err.message}`);
  }
}

/**
 * Performs a safe HTTP/HTTPS GET request with SSRF guard, redirect validation,
 * request timeout, and size limits.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const timeoutMs = options.timeoutMs ?? 10000;
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024; // 5MB default cap
  const maxRedirects = options.maxRedirects ?? 5;

  let currentUrl = rawUrl;
  let redirectsCount = 0;

  while (redirectsCount <= maxRedirects) {
    const { parsedUrl, resolvedIp } = await validateUrlForSsrf(currentUrl);
    const isHttps = parsedUrl.protocol === 'https:';

    const requestOptions: http.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...options.headers,
      },
      timeout: timeoutMs,
    };

    const result = await new Promise<{
      statusCode: number;
      headers: http.IncomingHttpHeaders;
      buffer: Buffer;
      redirectUrl?: string;
    }>((resolve, reject) => {
      const httpModule = isHttps ? https : http;

      const req = httpModule.request(requestOptions, (res) => {
        const statusCode = res.statusCode || 200;

        // Check for redirects (301, 302, 303, 307, 308)
        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          const redirectLocation = new URL(res.headers.location, currentUrl).toString();
          res.resume(); // Discard redirect response body
          return resolve({
            statusCode,
            headers: res.headers,
            buffer: Buffer.alloc(0),
            redirectUrl: redirectLocation,
          });
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy(new AppError('PAYLOAD_TOO_LARGE', `Response body exceeded size limit of ${maxBytes} bytes`, 413, {}, false));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          });
        });

        res.on('error', (err) => reject(err));
      });

      req.on('timeout', () => {
        req.destroy(new AppError('TIMEOUT', `Request timed out after ${timeoutMs}ms`, 504, {}, true));
      });

      req.on('error', (err) => reject(err));
      req.end();
    });

    if (result.redirectUrl) {
      redirectsCount++;
      if (redirectsCount > maxRedirects) {
        throw new AppError('TOO_MANY_REDIRECTS', `Exceeded maximum redirect limit of ${maxRedirects}`, 400, {}, false);
      }
      currentUrl = result.redirectUrl;
      continue;
    }

    const contentType = (result.headers['content-type'] as string) || '';
    const text = result.buffer.toString('utf-8');

    return {
      url: rawUrl,
      finalUrl: currentUrl,
      statusCode: result.statusCode,
      headers: result.headers,
      buffer: result.buffer,
      text,
      contentType,
    };
  }

  throw new AppError('TOO_MANY_REDIRECTS', `Exceeded redirect limit`, 400, {}, false);
}
