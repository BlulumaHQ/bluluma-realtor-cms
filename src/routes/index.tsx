import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bluluma Realtor CMS" },
      { name: "description", content: "Central listing and brand management system for Realtor websites." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">Bluluma</span>
            <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Realtor CMS</span>
          </div>
          <Link
            to="/admin/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
          >
            Enter CMS →
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bluluma</div>
          <h1 className="mt-6 font-display text-5xl md:text-6xl leading-[1.05] text-balance">
            Bluluma Realtor CMS
          </h1>
          <div className="gold-rule my-8 mx-auto max-w-xs" />
          <p className="text-lg text-muted-foreground max-w-xl mx-auto text-balance">
            Central listing and brand management system for Realtor websites.
          </p>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Link
              to="/admin/dashboard"
              className="inline-flex items-center px-8 h-12 bg-foreground text-background text-sm uppercase tracking-[0.18em] hover:bg-foreground/90 transition"
            >
              Enter CMS
            </Link>
            <Link
              to="/admin/realtors"
              className="inline-flex items-center px-8 h-12 border border-foreground/20 text-sm uppercase tracking-[0.18em] hover:bg-foreground hover:text-background transition"
            >
              Manage Realtors
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between text-xs text-muted-foreground">
          <span>© Bluluma</span>
          <span>Internal tool</span>
        </div>
      </footer>
    </div>
  );
}
