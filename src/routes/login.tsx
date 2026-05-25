import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import loginHero from "@/assets/login-hero.jpg";
import { DustParticles } from "@/components/DustParticles";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) || "/",
    mode: (search.mode as "signin" | "signup") || "signin",
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: search.redirect });
  },
  head: () => ({
    meta: [
      { title: "Sign in — Taalriya" },
      { name: "description", content: "Sign in to sync your riyaaz across devices." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { setMode(search.mode); }, [search.mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: search.redirect });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true); setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
      if (result.redirected) return;
      navigate({ to: search.redirect });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 -z-10">
        <img src={loginHero} alt="" aria-hidden width={1920} height={1280} className="h-full w-full object-cover" />
        <div className="absolute inset-0 vignette" />
        <div className="absolute inset-0 smoke pointer-events-none" />
        <div className="absolute inset-0 spotlight pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-br from-background/55 via-background/40 to-background/85" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>
      <DustParticles count={70} />

      <div className="relative z-10 w-full max-w-md animate-fade-up">
        <Link to="/" className="flex items-center gap-3 justify-center mb-8">
          <div className="h-10 w-10 rounded-full border border-[color:var(--gold)]/40 glow-gold flex items-center justify-center">
            <span className="font-display text-gold text-lg">ॐ</span>
          </div>
          <div className="font-display text-2xl text-gold">Taalriya</div>
        </Link>

        <div className="rounded-2xl p-7 border border-[color:var(--gold)]/20 bg-[color:var(--card)]/60 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)]">
          <h1 className="font-display text-2xl text-foreground text-center">
            {mode === "signup" ? "Begin your riyaaz" : "Welcome back"}
          </h1>
          <p className="text-xs text-muted-foreground text-center mt-1">
            {mode === "signup" ? "Create an account to sync across devices." : "Sign in to continue your practice."}
          </p>

          <button
            onClick={handleGoogle}
            disabled={busy}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full border border-border bg-[color:var(--card)] px-4 py-2.5 text-sm font-medium hover:border-[color:var(--gold)]/60 transition disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#EA4335" d="M12 11v3.2h4.5c-.2 1.2-1.4 3.6-4.5 3.6-2.7 0-4.9-2.2-4.9-5s2.2-5 4.9-5c1.5 0 2.6.6 3.2 1.2L17.5 6.7C16 5.3 14.1 4.5 12 4.5 7.9 4.5 4.5 7.9 4.5 12s3.4 7.5 7.5 7.5c4.3 0 7.2-3 7.2-7.3 0-.5-.1-.9-.1-1.2H12z" />
            </svg>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Name</label>
                <input
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
                  placeholder="Your name"
                />
              </div>
            )}
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Email</label>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Password</label>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60"
                placeholder="••••••••"
              />
            </div>

            {error && <div className="text-xs text-destructive">{error}</div>}
            {info && <div className="text-xs text-gold">{info}</div>}

            <button
              type="submit" disabled={busy}
              className="w-full rounded-full bg-[color:var(--gold)] px-4 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account?{" "}
                <button onClick={() => setMode("signin")} className="text-gold hover:underline">Sign in</button>
              </>
            ) : (
              <>New to Taalriya?{" "}
                <button onClick={() => setMode("signup")} className="text-gold hover:underline">Create account</button>
              </>
            )}
          </div>
        </div>

        <Link to="/" className="block text-center text-xs text-muted-foreground mt-6 hover:text-foreground">
          ← Continue without signing in
        </Link>
      </div>
    </main>
  );
}
