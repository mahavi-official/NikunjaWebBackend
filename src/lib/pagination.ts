export function calculateSkip(page: number, limit: number): number {
  return Math.max(0, (page - 1) * limit);
}

export function validatePagination(
  page?: string | number,
  limit?: string | number,
  defaults = { page: 1, limit: 20, max: 100 }
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, typeof page === "string" ? parseInt(page, 10) : page ?? defaults.page);
  const l = Math.min(
    defaults.max,
    Math.max(1, typeof limit === "string" ? parseInt(limit, 10) : limit ?? defaults.limit)
  );

  return {
    page: p,
    limit: l,
    skip: (p - 1) * l,
  };
}
