/** @type {import('next').NextConfig} */
const nextConfig = {
  // 🚀 هذا هو السطر السحري الذي سيحل المشكلة ويضغط حجم المشروع
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    memoryBasedWorkersCount: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "encrypted-tbn0.gstatic.com",
      },
    ],
  },
};

export default nextConfig;