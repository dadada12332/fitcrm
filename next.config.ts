import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
    ],
  },
  experimental: {
    // Tree-shakes icon/chart libraries: only used exports land in the bundle.
    // lucide-react: default import pulls in 1000+ icons — this reduces to ~10-20 used.
    // recharts: ~450 KB minified — only used chart components included.
    optimizePackageImports: ["lucide-react", "recharts"],
    // Вложения в обращения поддержки (скрин/видео/pdf/xlsx) идут через server action.
    serverActions: { bodySizeLimit: "20mb" },
  },
  // Старый прототип /v2 стал основным лендингом на / — редиректим старые ссылки.
  async redirects() {
    return [
      { source: "/v2", destination: "/", permanent: true },
      { source: "/v2/:path*", destination: "/", permanent: true },
    ]
  },
  // Базовые security-заголовки (без CSP/Permissions-Policy — чтобы не ломать
  // inline-стили и камеру QR-чекина). HSTS уже проставляет Vercel.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ]
  },
};

export default nextConfig;
