import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/pixelflow",
  // Next.js 16 blocks dev resources (HMR, /_next/*) from origins other than the
  // one Next was started with. When the page is opened on http://127.0.0.1:3001
  // but Next bound to localhost (or vice versa), HMR is blocked and client
  // components fail to hydrate — buttons appear inert. List the LAN/loopback
  // hosts we develop from here.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.124.4", "124.220.64.31"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
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
