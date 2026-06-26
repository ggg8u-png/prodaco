import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: false,
  images: {
    domains: [],
    unoptimized: true,
  },
};

export default nextConfig;
