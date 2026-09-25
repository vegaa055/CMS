import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; a stray lockfile in the home directory otherwise confuses Turbopack.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Enables forbidden() / unauthorized() for role checks.
    authInterrupts: true,
  },
};

export default nextConfig;
