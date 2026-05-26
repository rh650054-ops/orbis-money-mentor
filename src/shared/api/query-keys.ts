export interface QueryKeys<TFeature extends string> {
  all: readonly [TFeature];
  lists: () => readonly [TFeature, "list"];
  list: (filters?: Record<string, unknown>) => readonly [TFeature, "list", Record<string, unknown> | undefined];
  details: () => readonly [TFeature, "detail"];
  detail: (id: string) => readonly [TFeature, "detail", string];
  byUser: (userId: string) => readonly [TFeature, "by-user", string];
}

export function createQueryKeys<TFeature extends string>(feature: TFeature): QueryKeys<TFeature> {
  return {
    all: [feature] as const,
    lists: () => [feature, "list"] as const,
    list: (filters?: Record<string, unknown>) => [feature, "list", filters] as const,
    details: () => [feature, "detail"] as const,
    detail: (id: string) => [feature, "detail", id] as const,
    byUser: (userId: string) => [feature, "by-user", userId] as const,
  };
}
