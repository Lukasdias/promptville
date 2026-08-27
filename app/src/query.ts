import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchNeighborhood } from "./api";

export const neighborhoodQueryOptions = queryOptions({
  queryKey: ["neighborhood"],
  queryFn: fetchNeighborhood,
  staleTime: 1000 * 60 * 5,
  refetchOnWindowFocus: false,
});

export function useNeighborhood() {
  return useQuery(neighborhoodQueryOptions);
}