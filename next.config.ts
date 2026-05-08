import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Default 1MB terlalu kecil untuk upload bukti foto dari kamera HP.
    // Kompresi client-side biasanya bawa ke <1MB, tapi kasih buffer.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
