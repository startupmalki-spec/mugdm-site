import type { MetadataRoute } from "next";

const BASE_URL = "https://mugdm.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", changeFrequency: "weekly" as const, priority: 1.0 },
    { path: "/login", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/signup", changeFrequency: "monthly" as const, priority: 0.5 },
    { path: "/terms", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/privacy", changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    alternates: {
      languages: {
        ar: `${BASE_URL}/ar${route.path}`,
        en: `${BASE_URL}/en${route.path}`,
      },
    },
  }));
}
