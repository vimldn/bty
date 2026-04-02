import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from common beauty retailer CDNs
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.sephora.com" },
      { protocol: "https", hostname: "**.ulta.com" },
      { protocol: "https", hostname: "**.lookfantastic.com" },
    ],
  },
  // Vercel edge-ready headers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: process.env.ALLOWED_ORIGINS ?? "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Tenant-ID" },
        ],
      },
    ];
  },
};

export default nextConfig;
