import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/profile',
          '/cart',
          '/payment',
          '/subscriptions',
          '/wishlist',
          '/messages',
          '/verify',
          '/verify-email',
          '/verify-teacher',
          '/onboarding',
          '/r',
        ],
      },
    ],
    sitemap: 'https://ruhulqudus.com/sitemap.xml',
  };
}