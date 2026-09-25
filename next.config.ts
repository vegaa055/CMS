import type { NextConfig } from "next";

/** Let next/image optimize files served from the R2 public URL, if configured. */
function mediaRemotePatterns(): NonNullable<
  NextConfig["images"]
>["remotePatterns"] {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return [];
  const url = new URL(base);
  return [
    {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      pathname: `${url.pathname.replace(/\/$/, "")}/media/**`,
    },
  ];
}

const nextConfig: NextConfig = {
  // Pin the workspace root; a stray lockfile in the home directory otherwise confuses Turbopack.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Enables forbidden() / unauthorized() for role checks.
    authInterrupts: true,
  },
  images: {
    remotePatterns: mediaRemotePatterns(),
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
