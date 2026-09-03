import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 다른 상위 폴더의 lockfile을 저장소 루트로 오인하지 않도록 고정한다.
  outputFileTracingRoot: process.cwd(),
  trailingSlash: false,
  images: {
    domains: [],
    unoptimized: true,
  },
};

export default nextConfig;
