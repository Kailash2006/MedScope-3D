const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // triage-shared ships TS source consumed directly from the monorepo.
  transpilePackages: ["@medscope/triage-shared", "three", "@react-three/fiber", "@react-three/drei"],
  output: "standalone",
  experimental: {
    // Monorepo: deps are hoisted to the repo-root node_modules. Trace from the
    // repo root so the standalone bundle includes them. (In Next 14 this key
    // lives under `experimental`; the Docker build also ships a root lockfile so
    // the trace root is detected regardless.)
    outputFileTracingRoot: path.join(__dirname, "../../"),
  },
};

module.exports = nextConfig;
