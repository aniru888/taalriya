import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { Cloud, CloudOff, LogOut, Crown } from "lucide-react";
import { fetchProfile } from "@/lib/cloud-sync";

export function UserMenu() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<"free" | "premium">("free");
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setTier("free"); setName(null); return; }
    fetchProfile().then((p) => {
      if (p) { setTier(p.tier); setName(p.display_name); }
    });
  }, [user]);

  if (loading) return null;

  if (!user) {
    return (
      <Link
        to="/login"
        className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--gold)]/40 text-gold px-3 py-1.5 text-xs hover:glow-gold transition"
      >
        <Cloud className="h-3.5 w-3.5" /> Sign in
      </Link>
    );
  }

  const initial = (name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-border bg-[color:var(--card)]/70 pl-1 pr-3 py-1 hover:border-[color:var(--gold)]/50 transition"
      >
        <span className="h-7 w-7 rounded-full bg-[color:var(--accent)] flex items-center justify-center font-display text-sm text-gold">
          {initial}
        </span>
        <span className="text-xs text-foreground hidden sm:inline">{name || user.email}</span>
        {tier === "premium" && <Crown className="h-3.5 w-3.5 text-gold" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-xl border border-border bg-[color:var(--card)] p-3 shadow-2xl">
            <div className="px-2 py-1.5 border-b border-border mb-2">
              <div className="text-sm font-display text-foreground truncate">{name || "Riyaaz student"}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user.email}</div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)]/60 px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {tier === "premium" ? <><Crown className="h-3 w-3 text-gold" /> <span className="text-gold">Premium</span></> : <span className="text-muted-foreground">Free tier</span>}
              </div>
            </div>
            <div className="px-2 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
              {tier === "premium" ? <><Cloud className="h-3 w-3 text-gold" /> Synced to cloud</> : <><CloudOff className="h-3 w-3" /> Local only</>}
            </div>
            <button
              onClick={() => { setOpen(false); signOut(); }}
              className="mt-1 w-full inline-flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-foreground hover:bg-[color:var(--accent)]/50 transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
