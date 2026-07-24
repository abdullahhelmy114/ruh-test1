/** @type {import('next').NextConfig} */
const nextConfig = {
  // تخطي فحص الأخطاء أثناء الرفع لتوفير الرامات السيرفر (لأننا فحصناها محلياً)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // تقليل استهلاك الذاكرة أثناء ضغط الملفات
  experimental: {
    memoryBasedWorkersCount: true,
  },
};

export default nextConfig; // أو module.exports = nextConfig; حسب ملفك