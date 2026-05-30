import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks dev resources (HMR, /_next/*) from origins other than the
  // one Next was started with. When the page is opened on http://127.0.0.1:3000
  // but Next bound to localhost (or vice versa), HMR is blocked and client
  // components fail to hydrate — buttons appear inert. List the LAN/loopback
  // hosts we develop from here.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.124.4"],
  async rewrites() {
    return [
      {
        source: "/pixelflow-media/:path*",
        destination: "http://localhost:9000/pixelflow-media/:path*",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
