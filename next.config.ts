import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    maximumResponseBody: 60 * 1024 * 1024,
    qualities: [75, 90],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
