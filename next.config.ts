import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/sluizen": ["./database/sluizen_deploy.db"],
    "/api/sluizen/[...id]": ["./database/sluizen_deploy.db"],
    "/api/statistieken": ["./database/sluizen_deploy.db"],
    "/api/featured": ["./database/sluizen_deploy.db"],
  },
};

export default nextConfig;
