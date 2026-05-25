import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, ShieldOff, Crown, ShieldCheck } from "lucide-react";
import {
  listAdminRequests,
  reviewAdminRequest,
  listAdmins,
  demoteAdmin,
  myRoles,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async () => {
    const r = await myRoles();
    if (!r.isOwner) throw redirect({ to: "/admin/sounds" });
  },
  head: () => ({ meta: [{ title: "Admin Management — Owner" }] }),
  component: AdminUsersPage,
});

interface ReqRow {
  id: string;
  user_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  profile: { email: string | null; display_name: string | null } | null;
}

interface AdminRow {
  user_id: string;
  role: "owner" | "admin";
  created_at: string;
  profile: { email: string | null; display_name: string | null } | null;
}

function AdminUsersPage() {
  const fetchReqs = useServerFn(listAdminRequests);
  const review = useServerFn(reviewAdminRequest);
  const fetchAdmins = useServerFn(listAdmins);
  const demote = useServerFn(demoteAdmin);
  const [reqs, setReqs] = useState<ReqRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const [r, a] = await Promise.all([fetchReqs(), fetchAdmins()]);
    setReqs(r.requests as ReqRow[]);
    setAdmins(a.admins as AdminRow[]);
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const onReview = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await review({ data: { id, approve } });
      await refresh();
    } finally { setBusy(null); }
  };

  const onDemote = async (userId: string) => {
    if (!confirm("Revoke admin access from this user?")) return;
    setBusy(userId);
    try {
      await demote({ data: { user_id: userId } });
      await refresh();
    } finally { setBusy(null); }
  };

  const pending = reqs.filter((r) => r.status === "pending");
  const reviewed = reqs.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <section className="glass rounded-2xl p-5">
        <h3 className="font-display text-xl text-gold mb-4">Pending requests ({pending.length})</h3>
        {pending.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No pending requests.</div>
        ) : (
          <ul className="space-y-2">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-[color:var(--card)]/60 p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-display text-lg text-foreground">{r.profile?.display_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{r.profile?.email}</div>
                  {r.message && <p className="text-xs text-foreground/80 mt-2 italic">"{r.message}"</p>}
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Requested {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => onReview(r.id, true)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[color:var(--gold)] px-3 py-1.5 text-xs text-[color:var(--primary-foreground)] disabled:opacity-50"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    onClick={() => onReview(r.id, false)}
                    disabled={busy === r.id}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <h3 className="font-display text-xl text-gold mb-4">Current admins ({admins.length})</h3>
        <ul className="space-y-2">
          {admins.map((a) => (
            <li key={a.user_id + a.role} className="rounded-xl border border-border bg-[color:var(--card)]/60 p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                {a.role === "owner" ? (
                  <Crown className="h-4 w-4 text-gold" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-gold" />
                )}
                <div>
                  <div className="font-display text-base text-foreground">{a.profile?.display_name || "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{a.profile?.email} · {a.role}</div>
                </div>
              </div>
              {a.role === "admin" && (
                <button
                  onClick={() => onDemote(a.user_id)}
                  disabled={busy === a.user_id}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                >
                  <ShieldOff className="h-3 w-3" /> Demote
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {reviewed.length > 0 && (
        <section className="glass rounded-2xl p-5">
          <h3 className="font-display text-xl text-gold mb-4">Past requests</h3>
          <ul className="space-y-1.5">
            {reviewed.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/40 pb-1.5">
                <span>{r.profile?.email}</span>
                <span className={r.status === "approved" ? "text-gold" : "text-destructive"}>
                  {r.status} · {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString() : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
