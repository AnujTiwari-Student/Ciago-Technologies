import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLookups, type LookupBundle, type StatusKind } from "@/lib/lookups.functions";

const EMPTY: LookupBundle = {
  departments: [],
  employment_types: [],
  statuses: { job_posting: [], application: [], user_account: [] },
};

export function useLookups() {
  const fetchFn = useServerFn(listLookups);
  const { data } = useQuery({
    queryKey: ["lookups"],
    queryFn: () => fetchFn(),
    staleTime: 5 * 60 * 1000,
  });
  return data ?? EMPTY;
}

export function useStatusOptions(kind: StatusKind) {
  return useLookups().statuses[kind];
}
