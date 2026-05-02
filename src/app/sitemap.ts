import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") || 'https://nilamit--nilamit-52073.asia-southeast1.hosted.app';

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/en/auctions`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/en/search`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/en/login`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/en/register`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/en/privacy`, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${baseUrl}/en/terms`, changeFrequency: 'yearly', priority: 0.1 },
  ];
}
