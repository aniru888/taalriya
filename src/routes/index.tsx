import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import tablasHero from "@/assets/tablas-hero.jpg";
import { DustParticles } from "@/components/DustParticles";
import { TaalPlayer } from "@/components/TaalPlayer";
import { CustomTaalCreator } from "@/components/CustomTaalCreator";
import { TAALS, VARIATION_KEYS, VARIATION_LABELS, type VariationKey } from "@/lib/taals";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taalriya — Indian Classical Taal Practice" },
      {
        name: "description",
        content:
          "A cinematic tabla practice studio for Indian classical singing. Practice Dadra, Keharwa, Teen Taal, Rupak and Ektaal with theka, fast and tehai variations, plus a custom taal creator.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [activeTaalId, setActiveTaalId] = useState(TAALS[2].id);
  const [variation, setVariation] = useState<VariationKey>("theka");
  const [customOpen, setCustomOpen] = useState(false);

  const activeTaal = useMemo(
    () => TAALS.find((t) => t.id === activeTaalId)!,
    [activeTaalId],
  );

  const divisions = useMemo(
    () => activeTaal.divisions.split("+").map((s) => parseInt(s.trim(), 10)),
    [activeTaal],
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Hero background */}
      <div className="absolute inset-0 -z-10">
        <img
          src={tablasHero}
          alt=""
          aria-hidden
          width={1920}
          height={1280}
          className="h-full w-full object-cover opacity-70"
        />
        <div className="absolute inset-0 vignette" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />
      </div>
      <DustParticles count={50} />

      {/* Header */}
      <header className="relative z-10 px-6 md:px-12 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-[color:var(--gold)]/40 glow-gold flex items-center justify-center">
            <span className="font-display text-gold text-lg">ॐ</span>
          </div>
          <div>
            <div className="font-display text-xl text-gold leading-none">Taalriya</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Classical Riyaaz Studio
            </div>
          </div>
        </div>
        <button
          onClick={() => setCustomOpen((v) => !v)}
          className="hidden sm:inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:border-[color:var(--gold)]/60 transition"
        >
          {customOpen ? "Back to Taals" : "Custom Taal"}
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-12 pt-16 pb-12 text-center max-w-4xl mx-auto">
        <h1 className="font-display text-5xl md:text-7xl leading-[1.05] text-gold animate-fade-up">
          The rhythm of riyaaz,<br className="hidden md:block" /> in your hands.
        </h1>
        <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.1s" }}>
          A cinematic practice companion for Indian classical singers. Stay in taal with realistic
          tabla bols, every variation a guru would teach.
        </p>
      </section>

      <div className="relative z-10 px-4 md:px-12 pb-24 max-w-6xl mx-auto">
        {!customOpen ? (
          <>
            {/* Taal selector */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {TAALS.map((t) => {
                const active = t.id === activeTaalId;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setActiveTaalId(t.id);
                      setVariation("theka");
                    }}
                    className={[
                      "rounded-full px-4 py-2 text-sm border transition",
                      active
                        ? "border-[color:var(--gold)] text-gold bg-[color:var(--accent)] glow-gold"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
                    ].join(" ")}
                  >
                    {t.name}
                    <span className="ml-2 text-[10px] opacity-70 tabular-nums">{t.beats}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-center text-xs text-muted-foreground mb-6">
              <span className="font-display text-base text-foreground/80">{activeTaal.name}</span>
              {" · "}
              {activeTaal.beats} beats ({activeTaal.divisions}) · {activeTaal.description}
            </div>

            {/* Variation tabs */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {VARIATION_KEYS.map((key) => {
                const active = key === variation;
                return (
                  <button
                    key={key}
                    onClick={() => setVariation(key)}
                    className={[
                      "rounded-full px-3.5 py-1.5 text-xs uppercase tracking-wider border transition",
                      active
                        ? "border-[color:var(--gold)]/70 text-gold bg-[color:var(--accent)]/70"
                        : "border-border text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {VARIATION_LABELS[key]}
                  </button>
                );
              })}
            </div>

            <TaalPlayer
              bols={activeTaal[variation]}
              title={`${activeTaal.name} — ${VARIATION_LABELS[variation]}`}
              subtitle={`${activeTaal.beats} beat cycle · ${activeTaal.divisions}`}
              divisions={divisions}
            />

            <div className="mt-10 text-center sm:hidden">
              <button
                onClick={() => setCustomOpen(true)}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:border-[color:var(--gold)]/60 transition"
              >
                Create Custom Taal
              </button>
            </div>
          </>
        ) : (
          <CustomTaalCreator />
        )}
      </div>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-muted-foreground/70">
        Crafted for riyaaz · Tabla bols synthesized live · Stay in taal.
      </footer>
    </main>
  );
}
