export function NoRealtorFound({ host }: { host: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-lg text-center">
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Domain not configured</div>
        <h1 className="mt-4 font-display text-4xl">No realtor mapped to this domain</h1>
        <p className="mt-4 text-muted-foreground">
          The domain <code className="px-2 py-0.5 bg-muted rounded">{host}</code> is not registered in
          <code className="mx-1 px-2 py-0.5 bg-muted rounded">realtor_domains</code>. Add it from the admin
          panel to display a realtor's site here.
        </p>
        <a
          href="/admin"
          className="mt-8 inline-flex items-center px-6 h-11 border border-foreground/20 text-sm uppercase tracking-[0.18em] hover:bg-foreground hover:text-background transition"
        >
          Open Admin
        </a>
      </div>
    </div>
  );
}
