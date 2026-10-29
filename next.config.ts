import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The Docker image runs the self-contained server; Vercel builds its own way.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // A build check can go to its own folder while a dev server holds .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  productionBrowserSourceMaps: false,
  serverExternalPackages: ["three"],
  outputFileTracingExcludes: {
    "*": ["public/models/**", "public/draco/**"],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = false;
    }
    return config;
  },
};

export default nextConfig;
