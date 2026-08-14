/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // triage-shared ships TS source consumed directly from the monorepo.
  transpilePackages: ["@medscope/triage-shared"],
  output: "standalone",
};

module.exports = nextConfig;
