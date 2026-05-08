import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { fileToBase64 } from "@/hooks/use-admin";
import {
  adminListRealtors, adminUpsertRealtor,
  adminListDomains, adminUpsertDomain, adminDeleteDomain,
  adminUpload,
} from "@/lib/admin.functions";
import type { Realtor } from "@/lib/types";

export const Route = createFileRoute("/admin/realtors")({ component: () => <AdminShell><Page /></AdminShell> });

function Page() {
  const lr = useServerFn(adminListRealtors);
  const realtors = useQuery({ queryKey: ["a-realtors"], queryFn: () => lr({ data: {} }), enabled: true });
  const [editing, setEditing] = useState<Realtor | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-4xl">Realtors</h1>
          <div className="gold-rule mt-4 max-w-xs" />
        </div>
        <button onClick={() => { setCreating(true); setEditing({} as Realtor); }} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">+ New realtor</button>
      </div>

      <div className="bg-card shadow-card divide-y divide-border">
        {(realtors.data ?? []).map((r) => (
          <div key={r.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {r.headshot_url && <img src={r.headshot_url} className="h-12 w-12 rounded-full object-cover" />}
              <div>
                <div className="font-display text-lg">{r.name}</div>
                <div className="text-sm text-muted-foreground">{r.brokerage_name} · {r.slug}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {r.slug && (
                <a href={`/preview/${r.slug}`} target="_blank" rel="noreferrer" className="text-sm text-accent">Preview Site ↗</a>
              )}
              <button onClick={() => { setCreating(false); setEditing(r); }} className="text-sm text-accent">Edit →</button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <RealtorEditor
          realtor={editing}
          isNew={creating}
          onClose={() => { setEditing(null); setCreating(false); realtors.refetch(); }}
        />
      )}
    </div>
  );
}

function RealtorEditor({ realtor, isNew, onClose }: { realtor: Realtor; isNew: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [r, setR] = useState<Partial<Realtor>>(realtor);
  const upsert = useServerFn(adminUpsertRealtor);
  const upload = useServerFn(adminUpload);

  const save = async () => {
    await upsert({ data: { realtor: r } });
    qc.invalidateQueries({ queryKey: ["a-realtors"] });
    onClose();
  };

  const uploadAsset = async (file: File, kind: "logo" | "headshot") => {
    const base64 = await fileToBase64(file);
    const path = `${r.slug ?? "realtor"}/${kind}-${Date.now()}-${file.name}`;
    const { url } = await upload({ data: { bucket: "realtor-assets", path, contentType: file.type, base64 } });
    setR((s) => ({ ...s, [kind === "logo" ? "logo_url" : "headshot_url"]: url }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-background w-full max-w-3xl my-8 p-8 shadow-luxury" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl">{isNew ? "New realtor" : "Edit realtor"}</h2>
          <button onClick={onClose} className="text-muted-foreground">Close</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name"><input value={r.name ?? ""} onChange={(e) => setR({ ...r, name: e.target.value })} className="input" /></Field>
          <Field label="Slug"><input value={r.slug ?? ""} onChange={(e) => setR({ ...r, slug: e.target.value })} className="input" /></Field>
          <Field label="Brokerage"><input value={r.brokerage_name ?? ""} onChange={(e) => setR({ ...r, brokerage_name: e.target.value })} className="input" /></Field>
          <Field label="Email"><input value={r.email ?? ""} onChange={(e) => setR({ ...r, email: e.target.value })} className="input" /></Field>
          <Field label="Phone"><input value={r.phone ?? ""} onChange={(e) => setR({ ...r, phone: e.target.value })} className="input" /></Field>
          <Field label="Website domain"><input value={r.website_domain ?? ""} onChange={(e) => setR({ ...r, website_domain: e.target.value })} className="input" /></Field>
          <Field label="Brand color"><input value={r.brand_color ?? ""} onChange={(e) => setR({ ...r, brand_color: e.target.value })} className="input" placeholder="#000000" /></Field>
          <Field label="Logo">
            <div className="flex items-center gap-3">
              {r.logo_url && <img src={r.logo_url} className="h-10" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], "logo")} />
            </div>
          </Field>
          <Field label="Headshot">
            <div className="flex items-center gap-3">
              {r.headshot_url && <img src={r.headshot_url} className="h-10 w-10 rounded-full object-cover" />}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], "headshot")} />
            </div>
          </Field>
        </div>
        <Field label="Bio">
          <textarea value={r.bio ?? ""} onChange={(e) => setR({ ...r, bio: e.target.value })} className="input min-h-32" />
        </Field>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 h-10 border border-border text-sm uppercase tracking-[0.18em]">Cancel</button>
          <button onClick={save} className="px-5 h-10 bg-foreground text-background text-sm uppercase tracking-[0.18em]">Save</button>
        </div>

        {!isNew && r.id && <DomainsPanel realtorId={r.id} />}

        <style>{`.input{width:100%;height:2.75rem;padding:0 .75rem;border:1px solid var(--border);background:var(--background)}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function DomainsPanel({ realtorId }: { realtorId: string }) {
  const ld = useServerFn(adminListDomains);
  const ud = useServerFn(adminUpsertDomain);
  const dd = useServerFn(adminDeleteDomain);
  const domains = useQuery({ queryKey: ["a-domains", realtorId], queryFn: () => ld({ data: { realtorId } }) });
  const [d, setD] = useState("");
  const [t, setT] = useState("production");

  const add = async () => {
    if (!d.trim()) return;
    await ud({ data: { domain: { realtor_id: realtorId, domain: d, domain_type: t, is_primary: false } } });
    setD("");
    domains.refetch();
  };

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <h3 className="font-display text-xl mb-4">Domains</h3>
      <div className="space-y-2 mb-4">
        {(domains.data ?? []).map((row) => (
          <div key={row.id} className="flex items-center justify-between bg-card px-4 h-11 border border-border">
            <div className="text-sm"><span className="font-medium">{row.domain}</span> <span className="text-muted-foreground">· {row.domain_type}</span></div>
            <button onClick={async () => { await dd({ data: { id: row.id } }); domains.refetch(); }} className="text-destructive text-sm">Delete</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={d} onChange={(e) => setD(e.target.value)} placeholder="example.com" className="flex-1 h-11 px-3 border border-border bg-background" />
        <select value={t} onChange={(e) => setT(e.target.value)} className="h-11 px-3 border border-border bg-background">
          <option value="production">production</option>
          <option value="lovable">lovable</option>
          <option value="netlify">netlify</option>
          <option value="dev">dev</option>
        </select>
        <button onClick={add} className="px-5 h-11 bg-foreground text-background text-sm uppercase tracking-[0.18em]">Add</button>
      </div>
    </div>
  );
}
