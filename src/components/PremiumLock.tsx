import { Crown, Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface Props {
  title: string;
  body: string;
  isSignedIn: boolean;
}

export function PremiumLock({ title, body, isSignedIn }: Props) {
  return (
    <div className="glass rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto">
      <div className="inline-flex h-14 w-14 rounded-full border border-[color:var(--gold)]/40 glow-gold items-center justify-center mb-4">
        <Crown className="h-6 w-6 text-gold" />
      </div>
      <h3 className="font-display text-2xl md:text-3xl text-gold">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">{body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {!isSignedIn ? (
          <Link
            to="/login"
            search={{ redirect: "/", mode: "signup" }}
            className="rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 transition"
          >
            Sign in to continue
          </Link>
        ) : (
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--gold)] px-5 py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold opacity-80 cursor-not-allowed"
            title="Upgrades coming soon"
          >
            <Crown className="h-4 w-4" /> Upgrade to Premium
          </button>
        )}
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
          <Lock className="h-3 w-3" /> Coming soon
        </span>
      </div>
    </div>
  );
}
