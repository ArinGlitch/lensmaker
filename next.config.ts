import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep provider SDKs out of the bundler; they are server-only.
  serverExternalPackages: ["@google/genai", "@aws-sdk/client-bedrock-runtime"],
  /* config options here */
};

export default nextConfig;
