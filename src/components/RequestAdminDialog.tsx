import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, X } from "lucide-react";
import { createAdminRequest } from "@/lib/admin.functions";

export function RequestAdminDialog({ onClose }: { onClose: () => void }) {
  const submit = useServerFn(createAdminRequest);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<null | "pending" | "submitted">(null);
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await submit({ data: { message: message.trim() || undefined } });
      setDone(r.alreadyPending ? "pending" : "submitted");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md glass rounded-2xl p-6">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-9 w-9 rounded-full border border-[color:var(--gold)]/50 glow-gold flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-gold" />
          </div>
          <h2 className="font-display text-xl text-gold">Request admin access</h2>
        </div>
        {done ? (
          <>
            <p className="text-sm text-foreground">
              {done === "pending"
                ? "You already have a pending request. The owner will review it shortly."
                : "Request submitted. The owner will review and respond soon."}
            </p>
            <button onClick={onClose} className="mt-4 w-full rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)]">
              Close
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              Admins can upload tabla, tanpura, and taal loop recordings to the shared library.
              Only the owner can approve admin access.
            </p>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Message (optional)</label>
            <textarea
              rows={3}
              value={message}
              maxLength={1000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell the owner why you'd like admin access…"
              className="w-full rounded-lg bg-[color:var(--input)] border border-border px-3 py-2 text-foreground focus:outline-none focus:border-[color:var(--gold)]/60 resize-none"
            />
            {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
            <div className="mt-4 flex items-center gap-2 justify-end">
              <button onClick={onClose} className="rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={handle}
                disabled={busy}
                className="rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)] glow-gold hover:brightness-110 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Submit request"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
