import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRealtorByHost } from "@/lib/realtor.functions";
import { useRealtorContext } from "@/lib/realtor-context";

export function useRealtor() {
  const ctx = useRealtorContext();
  const fn = useServerFn(getRealtorByHost);
  const query = useQuery({
    queryKey: ["realtor-by-host"],
    queryFn: () => {
      const host = typeof window !== "undefined" ? window.location.host : "";
      return fn({ data: { host } });
    },
    staleTime: 5 * 60 * 1000,
    enabled: !ctx?.realtor,
  });
  if (ctx?.realtor) {
    return { data: { realtor: ctx.realtor, host: "preview" }, isLoading: false, isError: false } as const;
  }
  return { data: query.data, isLoading: query.isLoading, isError: query.isError } as const;
}
