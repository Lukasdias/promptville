import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchNeighborhood, fetchSession } from "./api";

export const neighborhoodQueryOptions = queryOptions({
  queryKey: ["neighborhood"],
  queryFn: fetchNeighborhood,
  staleTime: 1000 * 60 * 5,
  refetchOnWindowFocus: false,
});

export function useNeighborhood() {
  return useQuery(neighborhoodQueryOptions);
}

export const sessionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["session", id],
    queryFn: () => fetchSession(id),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

export function useSession(id: string | null | undefined) {
  return useQuery({
    queryKey: ["session", id ?? "none"],
    queryFn: () => {
      if (!id) return Promise.reject(new Error("no session selected"));
      return fetchSession(id);
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });
}
