import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Content-Security-Policy — relaxed in dev to allow HMR websockets
const CSP = [
  "default-src 'self'",
  // Scripts: self + inline eval needed by Next.js dev overlay; restrict in prod
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline'",
  // Styles: inline styles used by Tailwind and Framer Motion
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Images: data URIs for favicon, blob for any future generated images
  "img-src 'self' data: blob:",
  // API calls: self (Next.js routes) + Open-Meteo (called server-side only)
  "connect-src 'self' https://api.open-meteo.com https://nominatim.openstreetmap.org wss:",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Allow large contract response payloads
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: CSP,
          },
          // Only send HSTS in production — avoids breaking localhost HTTPS
          ...(!isDev
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },

  // Transpile genlayer-js (ESM)
  transpilePackages: ["genlayer-js"],
};

export default nextConfig;
