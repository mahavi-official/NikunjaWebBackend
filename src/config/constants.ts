export const API_VERSION = "v1";
export const API_PREFIX = `/api/${API_VERSION}`;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

export const FILE_LIMITS = {
  IMAGE_MAX_MB: 10,
  PDF_MAX_MB: 50,
  IMAGE_MAX_BYTES: 10 * 1024 * 1024,
  PDF_MAX_BYTES: 50 * 1024 * 1024,
};

export const IMAGE_SIZES = {
  THUMB: { width: 200, height: 200 },
  MEDIUM: { width: 600, height: 400 },
  LARGE: { width: 1200, height: 800 },
  OG: { width: 1200, height: 630 },
};

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  MEMBER: "MEMBER",
} as const;

export const USER_STATUS = {
  WHITELISTED: "WHITELISTED",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;

export const CONTENT_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
} as const;

export const PLACEMENT = {
  ARTICLE: "ARTICLE",
  BLOG: "BLOG",
  BOTH: "BOTH",
} as const;

export const CATEGORY_SCOPE = {
  ARTICLE: "ARTICLE",
  BLOG: "BLOG",
  RESEARCH: "RESEARCH",
} as const;

export const RATE_LIMITS = {
  GLOBAL_PER_MINUTE: 100,
  CONTACT_PER_HOUR: 3,
  NEWSLETTER_PER_HOUR: 5,
  AUTH_CALLBACK_PER_MINUTE: 10,
};

export const CACHE_CONTROL = {
  PUBLIC_SHORT: "public, s-maxage=60, stale-while-revalidate=300",
  PUBLIC_MEDIUM: "public, s-maxage=300, stale-while-revalidate=600",
  PUBLIC_LONG: "public, s-maxage=3600, stale-while-revalidate=86400",
  PRIVATE: "private, no-cache, no-store, must-revalidate",
};

export const JWT_CLAIMS = {
  ACCESS_TTL_MINUTES: 15,
  REFRESH_TTL_DAYS: 30,
} as const;

export const AUDIT_ACTIONS = {
  AUTH_LOGIN: "auth.login",
  AUTH_LOGOUT: "auth.logout",
  AUTH_LOGOUT_ALL: "auth.logout_all",
  AUTH_REFRESH: "auth.refresh",
  /// A rotated refresh token was presented again; every session for the
  /// account was revoked. Worth alerting on.
  AUTH_REFRESH_REUSE: "auth.refresh_reuse_detected",

  POST_CREATE: "post.create",
  POST_UPDATE: "post.update",
  POST_DELETE: "post.delete",
  POST_PUBLISH: "post.publish",
  POST_UNPUBLISH: "post.unpublish",

  RESEARCH_CREATE: "research.create",
  RESEARCH_UPDATE: "research.update",
  RESEARCH_DELETE: "research.delete",
  RESEARCH_PUBLISH: "research.publish",
  RESEARCH_FILE_VIEW: "research.file.view",

  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  USER_SUSPEND: "user.suspend",
  USER_ACTIVATE: "user.activate",

  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",

  SETTINGS_UPDATE: "settings.update",
} as const;

export const SITEMAP = {
  ITEMS_PER_FILE: 5000,
  CACHE_TTL_MINUTES: 60,
} as const;

export const SIGNED_BLOB_URL_TTL = 60; // seconds

export const SEARCH_WEIGHTS = {
  TITLE: "A",
  EXCERPT_ABSTRACT: "B",
  BODY_CONTENT: "C",
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
} as const;
