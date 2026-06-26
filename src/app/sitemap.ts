import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://ruhulqudus.net', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://ruhulqudus.net/marketplace', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://ruhulqudus.net/community', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://ruhulqudus.net/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://ruhulqudus.net/signup', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}