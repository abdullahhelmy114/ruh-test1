/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // الصور
      "img-src 'self' data: blob: https://encrypted-tbn0.gstatic.com https://source.unsplash.com https://images.unsplash.com https://*.googleusercontent.com",
      // الخطوط
      "font-src 'self' https://fonts.gstatic.com",
      // الأنماط
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // السكربتات
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://*.firebaseio.com https://www.google.com",
      // الاتصالات
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.google-analytics.com https://api.openai.com https://generativelanguage.googleapis.com",
      // الإطارات
      "frame-src 'self' https://www.youtube.com https://*.firebaseapp.com https://*.google.com",
      // تقييد الكائنات
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      // ترقية الروابط غير الآمنة
      "upgrade-insecure-requests",
    ].join("; "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    key: "Cross-Origin-Resource-Policy",
    value: "same-origin",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
];

const nextConfig = {
  // تفعيل وضع standalone لتقليل حجم الحزمة وسهولة النشر
  output: "standalone",

  // إيقاف توليد ETag لتقليل الحمولة (اختياري)
  generateEtags: false,

  // إيقاف تعليق powered-by-header للأمان
  poweredByHeader: false,

  // ضغط الاستجابات
  compress: true,

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
      // إضافة نطاقات الصور المستخدمة في الكورسات والدروس
      {
        protocol: "https",
        hostname: "source.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // إضافة headers الأمان لجميع المسارات
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;