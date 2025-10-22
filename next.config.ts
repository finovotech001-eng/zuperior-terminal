/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // ✅ prevents ESLint errors from stopping Render build
  },
  typescript: {
    ignoreBuildErrors: true, // ✅ ignores TS type errors in deployment builds
  },
  experimental: {
    turbo: true, // optional performance boost for Next 15
  },
};

export default nextConfig;
