import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRealtorByHost } from "@/lib/realtor.functions";

export function useRealtor() {
  const fn = useServerFn(getRealtorByHost);
  return useQuery({
    queryKey: ["realtor-by-host"],
    queryFn: () => {
      const host = typeof window !== "undefined" ? window.location.host : "";
      return fn({ data: { host } });
    },
    staleTime: 5 * 60 * 1000,
  });
}
