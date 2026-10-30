import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { validateUrlForSsrf, safeFetch, SsrfError } from '../src/utils/ssrf';

describe('SSRF Protection Guard', () => {
  let mockServer: http.Server;
  let mockPort: number;

  beforeAll(async () => {
    // Spin up an ephemeral local HTTP test server to test redirect behavior
    mockServer = http.createServer((req, res) => {
      if (req.url === '/redirect-to-localhost') {
        res.writeHead(302, { Location: `http://127.0.0.1:${mockPort}/secret` });
        res.end();
      } else if (req.url === '/redirect-to-metadata') {
        res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' });
        res.end();
      } else if (req.url === '/secret') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('INTERNAL_SECRET_DATA');
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      }
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        mockPort = (mockServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()));
  });

  it('blocks localhost and loopback domains', async () => {
    await expect(validateUrlForSsrf('http://localhost:3000/admin')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://test.localhost/api')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://service.local/')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://metadata.google.internal/')).rejects.toThrow(SsrfError);
  });

  it('blocks IPv4 127.x.x.x loopback range', async () => {
    await expect(validateUrlForSsrf('http://127.0.0.1:8080')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://127.1.2.3:5000/status')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://127.255.255.254/')).rejects.toThrow(SsrfError);
  });

  it('blocks private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)', async () => {
    await expect(validateUrlForSsrf('http://10.0.0.1/private')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://10.254.1.1/')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://172.16.0.1/internal')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://172.31.255.255/')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://192.168.1.1/router')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://192.168.0.254:8080/')).rejects.toThrow(SsrfError);
  });

  it('blocks cloud metadata IP 169.254.169.254 and link-local range', async () => {
    await expect(
      validateUrlForSsrf('http://169.254.169.254/latest/meta-data/')
    ).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://169.254.0.1/')).rejects.toThrow(SsrfError);
  });

  it('blocks IPv6 loopback, link-local, and unique local addresses', async () => {
    await expect(validateUrlForSsrf('http://[::1]:8080')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://[fe80::1]/')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://[fc00::1]/')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('http://[::ffff:127.0.0.1]/')).rejects.toThrow(SsrfError);
  });

  it('blocks non-HTTP protocols', async () => {
    await expect(validateUrlForSsrf('file:///etc/passwd')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('ftp://evil.com/payload')).rejects.toThrow(SsrfError);
    await expect(validateUrlForSsrf('gopher://127.0.0.1:70/')).rejects.toThrow(SsrfError);
  });

  it('detects and blocks redirects leading to internal / loopback addresses', async () => {
    // Calling safeFetch on the redirect endpoint must fail when target resolves to loopback
    await expect(
      safeFetch(`http://127.0.0.1:${mockPort}/redirect-to-localhost`)
    ).rejects.toThrow(SsrfError);

    await expect(
      safeFetch(`http://127.0.0.1:${mockPort}/redirect-to-metadata`)
    ).rejects.toThrow(SsrfError);
  });
});
