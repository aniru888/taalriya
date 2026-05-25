import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { myRoles } from "@/lib/admin.functions";
import { ShieldCheck, Music2, Drum, Disc3, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    try {
      const { isAdmin } = await myRoles();
      if (!isAdmin) throw redirect({ to: "/" });
    } catch (e) {
      if (e && typeof e === "object" && "isRedirect" in (e as any)) throw e;
      throw redirect({ to: "/" });
    }
  },
  loader: async () => {
    const r = await myRoles();
    return { isOwner: r.isOwner };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { isOwner } = Route.useLoaderData();
  const loc = useLocation();

  const tabs = [
    { to: "/admin/sounds", label: "Tabla Bols", icon: Drum },
    { to: "/admin/tanpura", label: "Tanpura", icon: Disc3 },
    { to: "/admin/taals", label: "Taal Loops", icon: Music2 },
    ...(isOwner ? [{ to: "/admin/users", label: "Admin Management", icon: Users }] : []),
  ] as const;

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 vignette" />
        <div className="absolute inset-0 spotlight pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/80 to-background" />
      </div>

      <header className="px-4 sm:px-8 pt-6 pb-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-[color:var(--gold)]/50 glow-gold flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-gold" />
          </div>
          <div>
            <div className="font-display text-xl text-gold">Admin Dashboard</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {isOwner ? "Owner" : "Admin"} controls
            </div>
          </div>
        </div>
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to app</Link>
      </header>

      <nav className="px-4 sm:px-8 mt-4 flex flex-wrap gap-1">
        {tabs.map((t) => {
          const active = loc.pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={[
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                active
                  ? "bg-[color:var(--gold)] text-[color:var(--primary-foreground)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-[color:var(--accent)]/40",
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 sm:px-8 py-6 max-w-6xl mx-auto">
        <Outlet />
      </div>
    </main>
  );
}
