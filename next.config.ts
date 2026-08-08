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
};

export default nextConfig; // إذا كان الملف ينتهي بـ .ts أو .mjs
// module.exports = nextConfig; // استخدم هذا السطر فقط إذا كان الملف ينتهي بـ .js