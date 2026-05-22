import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import tablasHero from "@/assets/tablas-hero.jpg";
import { DustParticles } from "@/components/DustParticles";
import { TaalPlayer } from "@/components/TaalPlayer";
import { CustomTaalCreator } from "@/components/CustomTaalCreator";
import { SoundLibrary } from "@/components/SoundLibrary";
import { playByName, subscribeLibrary, getLibrary, findByName } from "@/lib/tabla-audio";
import { TAALS, VARIATION_KEYS, VARIATION_LABELS, type VariationKey } from "@/lib/taals";
import { useEffect } from "react";
import type { Step } from "@/components/TaalPlayer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taalriya — Indian Classical Taal Practice" },
      {
        name: "description",
        content:
          "A cinematic tabla practice studio for Indian classical singing. Upload your own tabla samples and practice Dadra, Keharwa, Teen Taal, Rupak and Ektaal with theka, fast and tehai variations.",
      },
    ],
  }),
  component: Home,
});

type View = "taals" | "custom" | "sounds";

const VIEWS: { id: View; label: string }[] = [
  { id: "taals", label: "Practice" },
  { id: "custom", label: "Custom Taal" },
  { id: "sounds", label: "Sounds" },
];

function Home() {
  const [activeTaalId, setActiveTaalId] = useState(TAALS[2].id);
  const [variation, setVariation] = useState<VariationKey>("theka");
  const [view, setView] = useState<View>("taals");

  const activeTaal = useMemo(
    () => TAALS.find((t) => t.id === activeTaalId)!,
    [activeTaalId],
  );

  const divisions = useMemo(
    () => activeTaal.divisions.split("+").map((s) => parseInt(s.trim(), 10)),
    [activeTaal],
  );

  // Re-render when library changes so preset step labels reflect availability
  const [, force] = useState(0);
  useEffect(() => subscribeLibrary(() => force((n) => n + 1)), []);

  const presetSteps: Step[] = activeTaal[variation].map((name) => {
    const has = Boolean(findByName(name));
    return {
      label: name,
      play: has ? (t, v) => playByName(name, t, v) : null,
    };
  });
  const missing = activeTaal[variation].filter(
    (n) => n !== "-" && !findByName(n),
  );
  const uniqueMissing = Array.from(new Set(missing));
  const libCount = getLibrary().length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
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

      <header className="relative z-10 px-6 md:px-12 pt-8 flex items-center justify-between gap-4 flex-wrap">
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
        <nav className="glass rounded-full p-1 flex items-center gap-1">
          {VIEWS.map((v) => {
            const active = v.id === view;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={[
                  "rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm transition",
                  active
                    ? "bg-[color:var(--gold)] text-[color:var(--primary-foreground)]"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {v.label}
              </button>
            );
          })}
        </nav>
      </header>

      <section className="relative z-10 px-6 md:px-12 pt-12 md:pt-16 pb-10 text-center max-w-4xl mx-auto">
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl leading-[1.05] text-gold animate-fade-up">
          The rhythm of riyaaz,<br className="hidden md:block" /> in your hands.
        </h1>
        <p
          className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          A cinematic practice companion for Indian classical singers. Upload your own tabla
          recordings and stay in taal — every bol, your own.
        </p>
      </section>

      <div className="relative z-10 px-4 md:px-12 pb-24 max-w-6xl mx-auto">
        {view === "taals" && (
          <>
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

            <div className="text-center text-xs text-muted-foreground mb-6 px-4">
              <span className="font-display text-base text-foreground/80">{activeTaal.name}</span>
              {" · "}
              {activeTaal.beats} beats ({activeTaal.divisions}) · {activeTaal.description}
            </div>

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

            {libCount > 0 && uniqueMissing.length > 0 && (
              <div className="mb-4 rounded-xl border border-border bg-[color:var(--card)]/60 p-3 text-xs text-muted-foreground">
                No bol named{" "}
                <span className="text-foreground font-display">
                  {uniqueMissing.slice(0, 4).join(", ")}
                  {uniqueMissing.length > 4 ? "…" : ""}
                </span>{" "}
                in your library — those beats will stay silent. Open Sounds to upload them.
              </div>
            )}
            {libCount === 0 && (
              <div className="mb-4 rounded-xl border border-[color:var(--gold)]/30 bg-[color:var(--accent)]/40 p-3 text-xs text-foreground">
                Your sound library is empty. Open the <span className="text-gold">Sounds</span> tab
                to upload your tabla recordings, then come back to practice.
              </div>
            )}

            <TaalPlayer
              steps={presetSteps}
              title={`${activeTaal.name} — ${VARIATION_LABELS[variation]}`}
              subtitle={`${activeTaal.beats} beat cycle · ${activeTaal.divisions}`}
              divisions={divisions}
            />
          </>
        )}

        {view === "custom" && <CustomTaalCreator />}
        {view === "sounds" && <SoundLibrary />}
      </div>


      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-muted-foreground/70">
        Crafted for riyaaz · Your own tabla, in perfect taal.
      </footer>
    </main>
  );
}
