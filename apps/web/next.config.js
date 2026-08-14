const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // triage-shared ships TS source consumed directly from the monorepo.
  transpilePackages: ["@medscope/triage-shared"],
  output: "standalone",
  // Monorepo: deps are hoisted to the repo-root node_modules. Trace from the
  // repo root so the standalone bundle actually includes them (otherwise
  // server.js boots with "Cannot find module 'next'"). Output nests the server
  // at standalone/apps/web/server.js — see deploy/Dockerfile.web.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

module.exports = nextConfig;
