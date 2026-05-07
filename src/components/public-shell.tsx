import { useRealtor } from "@/hooks/use-realtor";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { NoRealtorFound } from "@/components/no-realtor";

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useRealtor();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!data?.realtor) return <NoRealtorFound host={data?.host ?? ""} />;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader realtor={data.realtor} />
      <main className="flex-1">{children}</main>
      <SiteFooter realtor={data.realtor} />
    </div>
  );
}
