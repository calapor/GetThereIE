import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.111'],
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
};

export default nextConfig;
