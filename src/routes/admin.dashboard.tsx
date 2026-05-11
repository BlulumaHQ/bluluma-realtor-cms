import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin-shell";
import { Dashboard } from "./admin.index";

export const Route = createFileRoute("/admin/dashboard")({
  component: () => (
    <AdminShell>
      <Dashboard />
    </AdminShell>
  ),
});
