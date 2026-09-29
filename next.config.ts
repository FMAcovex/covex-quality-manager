import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const configuredServerActionOrigins = (process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const developmentServerActionOrigins =
  process.env.NODE_ENV === "development" ? ["localhost:3000", "127.0.0.1:3000"] : [];

const serverActionAllowedOrigins = Array.from(
  new Set([...developmentServerActionOrigins, ...configuredServerActionOrigins]),
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
      ...(serverActionAllowedOrigins.length
        ? { allowedOrigins: serverActionAllowedOrigins }
        : {}),
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
    ];
  },
};

export default nextConfig;
