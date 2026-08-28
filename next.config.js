/** @type {import('next').NextConfig} */

// Security headers applied to every response
const securityHeaders = [
  // ── 1. Content Security Policy ──────────────────────────────────────────────
  // Fixes: "Content Security Policy (CSP) Header Not Set" (CWE-693 / WASC-15)
  // Allows: self, Google Fonts (styles + fonts), cdnjs (Font Awesome CSS + fonts),
  //         Supabase API (fetch/connect), and inline styles needed by Next.js.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: self + inline; allow 'unsafe-eval' in dev mode for React HMR & debugging
      `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV !== 'production' ? "'unsafe-eval'" : ""}`.trim(),
      // Styles: self + Google Fonts + cdnjs (Font Awesome)
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      // Fonts: self + Google Fonts CDN + cdnjs (Font Awesome webfonts)
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      // Images: self + data URIs (for inline SVGs / base64 thumbnails) + blob (file previews)
      "img-src 'self' data: blob: https:",
      // Fetch / XHR: self + Supabase project URL
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      // Disallow all framing (see also X-Frame-Options below)
      "frame-ancestors 'none'",
      // No plugins, objects, or embeds
      "object-src 'none'",
      // Base URI locked to self
      "base-uri 'self'",
      // Form submissions only to self
      "form-action 'self'",
    ].join('; '),
  },

  // ── 2. Anti-Clickjacking ─────────────────────────────────────────────────────
  // Fixes: "Missing Anti-clickjacking Header"
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },

  // ── 3. MIME-Sniffing Prevention ───────────────────────────────────────────────
  // Fixes: "X-Content-Type-Options Header Missing"
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },

  // ── 4. Referrer Policy ────────────────────────────────────────────────────────
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },

  // ── 5. Permissions Policy ─────────────────────────────────────────────────────
  // Disable browser features not needed by this app
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },

  // ── 6. Cross-Origin Policies ──────────────────────────────────────────────────
  // Fixes: "Cross-Domain Misconfiguration"
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'require-corp',
  },
];

const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  async headers() {
    return [
      // Apply security headers to all routes
      {
        source: '/(.*)',
        headers: securityHeaders,
      },

      // ── 7. Cache-Control for API routes ────────────────────────────────────
      // Fixes: "Re-examine Cache-control Directives"
      // Prevent browsers/proxies from caching any API response (may contain PII)
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
          // ── CORS: only allow same-origin requests to API ──────────────────
          // Fixes: "Cross-Domain Misconfiguration"
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || 'https://adminats.vercel.app',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
        ],
      },

      // ── 8. Cache-Control for admin pages ───────────────────────────────────
      // Prevent caching of authenticated admin pages
      {
        source: '/admin(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

