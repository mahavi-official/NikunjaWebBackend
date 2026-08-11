import { env } from "@/config/env";
import { truncateText } from "./sanitize";

export interface SEOData {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  openGraph: {
    title: string;
    description: string;
    image?: string;
    type: "article" | "website" | "video.other";
    url: string;
    siteName: string;
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image?: string;
  };
  jsonLd: any[];
}

export function buildSeo(
  title: string,
  description: string,
  path: string,
  ogImage?: string,
  noIndex: boolean = false,
  ogType: "article" | "website" | "video.other" = "website",
  publishedTime?: string,
  modifiedTime?: string,
  author?: string
): SEOData {
  const fullTitle = title || env.SITE_URL;
  const fullDescription = description || "Radhakundah Platform";
  const canonical = `${env.SITE_URL}${path}`;
  const robots = noIndex ? "noindex, nofollow" : "index, follow";

  return {
    title: fullTitle,
    description: fullDescription,
    canonical,
    robots,
    openGraph: {
      title: fullTitle,
      description: fullDescription,
      image: ogImage,
      type: ogType,
      url: canonical,
      siteName: "Radhakundah",
      publishedTime,
      modifiedTime,
      author,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: fullDescription,
      image: ogImage,
    },
    jsonLd: [],
  };
}

export function buildArticleJsonLd(data: {
  title: string;
  description: string;
  content: string;
  author: string;
  publishedTime: string;
  modifiedTime: string;
  image?: string;
  url: string;
  keywords?: string[];
}): any {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.title,
    description: data.description,
    image: data.image,
    author: {
      "@type": "Person",
      name: data.author,
    },
    datePublished: data.publishedTime,
    dateModified: data.modifiedTime,
    articleBody: truncateText(data.content, 500),
    keywords: data.keywords?.join(", "),
  };
}

export function buildVideoJsonLd(data: {
  title: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string;
  embedUrl: string;
}): any {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: data.title,
    description: data.description,
    thumbnailUrl: data.thumbnailUrl,
    uploadDate: data.uploadDate,
    duration: data.duration || "PT0S",
    embedUrl: data.embedUrl,
  };
}

export function buildScholarlyArticleJsonLd(data: {
  title: string;
  abstract: string;
  authors: string[];
  datePublished: string;
  doi?: string;
  journal?: string;
  image?: string;
  url: string;
}): any {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: data.title,
    description: data.abstract,
    author: data.authors.map((name) => ({
      "@type": "Person",
      name,
    })),
    datePublished: data.datePublished,
    identifier: data.doi ? { "@type": "PropertyValue", propertyID: "doi", value: data.doi } : undefined,
    isPartOf: data.journal ? { "@type": "Periodical", name: data.journal } : undefined,
    image: data.image,
  };
}

export function buildOrganizationJsonLd(): any {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Radhakundah",
    url: env.SITE_URL,
    logo: `${env.SITE_URL}/logo.png`,
    sameAs: ["https://www.facebook.com/radhakundah"],
  };
}

export function buildBreadcrumbJsonLd(breadcrumbs: Array<{ name: string; url: string }>): any {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
