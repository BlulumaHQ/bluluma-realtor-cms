import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createFirstAdmin, setupStatus } from "@/lib/setup.functions";

export const Route = createFileRoute("/setup")({
  beforeLoad: async () => {
    const { completed } = await setupStatus();
    if (completed) throw redirect({ to: "/admin/login" });
  },
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const createAdmin = useServerFn(createFirstAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Password must be at least 10 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      const res = await createAdmin({ data: { email: email.trim(), password } });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      navigate({ to: "/admin/login", search: { setup: "1" }, replace: true } as any);
    } catch (err: any) {
      setError(err?.message ?? "Setup failed");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-card shadow-card p-8 space-y-5">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Bluluma</div>
          <h1 className="mt-2 font-display text-3xl">First-run setup</h1>
          <p className="mt-2 text-xs text-muted-foreground">Create the first admin account. This page becomes unavailable once complete.</p>
          <div className="gold-rule mt-3 max-w-[3rem]" />
        </div>
        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Email</div>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-11 px-3 border border-border bg-background" />
        </label>
        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Password (min 10)</div>
          <input type="password" required minLength={10} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-11 px-3 border border-border bg-background" />
        </label>
        <label className="block">
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">Confirm password</div>
          <input type="password" required minLength={10} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full h-11 px-3 border border-border bg-background" />
        </label>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <button type="submit" disabled={busy} className="w-full h-11 bg-foreground text-background text-sm uppercase tracking-[0.18em] disabled:opacity-60">
          {busy ? "Creating…" : "Create admin"}
        </button>
      </form>
    </div>
  );
}
