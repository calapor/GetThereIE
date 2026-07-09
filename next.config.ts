import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*'],
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  // Keep native SQLite modules external so standalone tracing includes them.
  serverExternalPackages: ['better-sqlite3', '@prisma/adapter-better-sqlite3', 'prisma'],
};

export default nextConfig;
