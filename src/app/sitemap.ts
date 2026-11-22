import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteConfig.url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteConfig.url}/order`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteConfig.url}/track`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
