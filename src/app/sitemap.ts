import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://Ruh-Ul-Qudus.net', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://Ruh-Ul-Qudus.net/courses', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://Ruh-Ul-Qudus.net/community', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://Ruh-Ul-Qudus.net/login', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://Ruh-Ul-Qudus.net/signup', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];
}