import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crown, Lock } from "lucide-react";
import tablasHero from "@/assets/tablas-hero.jpg";
import { DustParticles } from "@/components/DustParticles";
import { TaalPlayer } from "@/components/TaalPlayer";
import { CustomTaalCreator } from "@/components/CustomTaalCreator";
import { SoundLibrary } from "@/components/SoundLibrary";
import { TanpuraPanel } from "@/components/TanpuraPanel";
import { UserMenu } from "@/components/UserMenu";
import { PremiumLock } from "@/components/PremiumLock";
import {
  subscribeLibrary, getLibrary,
  setTablaSemitones,
} from "@/lib/tabla-audio";
import { TAALS, VARIATION_KEYS, VARIATION_LABELS, type VariationKey } from "@/lib/taals";
import { type Scale, setTanpuraVolume } from "@/lib/tanpura";
import { loadSettings, saveSettings } from "@/lib/settings";
import { useAuth } from "@/hooks/useAuth";
import { pullProfileIntoLocal, schedulePush, fetchProfile } from "@/lib/cloud-sync";
import type { Step } from "@/components/TaalPlayer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Taalriya — Indian Classical Taal Practice" },
      {
        name: "description",
        content:
          "A cinematic tabla practice studio for Indian classical singing. Upload your own tabla samples and tanpura loops, train with gradual BPM, and practice Dadra, Keharwa, Teen Taal, Rupak and Ektaal.",
      },
    ],
  }),
  component: Home,
});

type View = "taals" | "custom" | "sounds" | "tanpura";

const VIEWS: { id: View; label: string; premium?: boolean }[] = [
  { id: "taals", label: "Practice" },
  { id: "tanpura", label: "Tanpura", premium: true },
  { id: "custom", label: "Custom Taal" },
  { id: "sounds", label: "Sounds" },
];

function Home() {
  const initial = useMemo(() => loadSettings(), []);
  const [activeTaalId, setActiveTaalId] = useState(initial.taalId);
  const [variation, setVariation] = useState<VariationKey>(
    (VARIATION_KEYS as readonly string[]).includes(initial.variation)
      ? (initial.variation as VariationKey)
      : "theka",
  );
  const [view, setView] = useState<View>("taals");
  const [favorites, setFavorites] = useState<string[]>(initial.favorites);
  const [tablaST, setTablaST] = useState(initial.tablaSemitones);
  const [tanpuraScale, setTanpuraScale] = useState<Scale>(initial.tanpuraScale as Scale);
  const { user } = useAuth();
  const [tier, setTier] = useState<"free" | "premium">("free");

  // Hydrate audio engine with saved settings on mount
  useEffect(() => {
    setTablaSemitones(initial.tablaSemitones);
    setTanpuraVolume(initial.tanpuraVolume);
  }, [initial.tablaSemitones, initial.tanpuraVolume]);

  // Cloud sync: pull on sign-in, push on changes (premium gates writes)
  useEffect(() => {
    if (!user) { setTier("free"); return; }
    pullProfileIntoLocal().then((p) => {
      if (!p) return;
      setTier(p.tier);
      const s = loadSettings();
      setActiveTaalId(s.taalId);
      setVariation((VARIATION_KEYS as readonly string[]).includes(s.variation) ? (s.variation as VariationKey) : "theka");
      setFavorites(s.favorites);
      setTablaST(s.tablaSemitones);
      setTanpuraScale(s.tanpuraScale as Scale);
    });
  }, [user]);

  const cloudSyncEnabled = Boolean(user) && tier === "premium";

  // Persist when these change (+ push to cloud for premium users)
  useEffect(() => { saveSettings({ taalId: activeTaalId }); if (cloudSyncEnabled) schedulePush(); }, [activeTaalId, cloudSyncEnabled]);
  useEffect(() => { saveSettings({ variation }); if (cloudSyncEnabled) schedulePush(); }, [variation, cloudSyncEnabled]);
  useEffect(() => { saveSettings({ favorites }); if (cloudSyncEnabled) schedulePush(); }, [favorites, cloudSyncEnabled]);
  useEffect(() => {
    setTablaSemitones(tablaST);
    saveSettings({ tablaSemitones: tablaST });
    if (cloudSyncEnabled) schedulePush();
  }, [tablaST, cloudSyncEnabled]);
  useEffect(() => { saveSettings({ tanpuraScale }); if (cloudSyncEnabled) schedulePush(); }, [tanpuraScale, cloudSyncEnabled]);

  const activeTaal = useMemo(
    () => TAALS.find((t) => t.id === activeTaalId) ?? TAALS[2],
    [activeTaalId],
  );

  const divisions = useMemo(
    () => activeTaal.divisions.split("+").map((s) => parseInt(s.trim(), 10)),
    [activeTaal],
  );

  const [, force] = useState(0);
  useEffect(() => subscribeLibrary(() => force((n) => n + 1)), []);

  const presetSteps: Step[] = activeTaal[variation].map((name) => {
    const has = Boolean(findByName(name));
    return {
      label: name,
      play: has ? (t, v) => playByName(name, t, v) : null,
    };
  });
  const missing = activeTaal[variation].filter((n) => n !== "-" && !findByName(n));
  const uniqueMissing = Array.from(new Set(missing));
  const libCount = getLibrary().length;

  const isFav = favorites.includes(activeTaal.id);
  const toggleFav = () =>
    setFavorites((f) => (f.includes(activeTaal.id) ? f.filter((x) => x !== activeTaal.id) : [...f, activeTaal.id]));

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 -z-10">
        <img
          src={tablasHero} alt="" aria-hidden width={1920} height={1280}
          className="h-full w-full object-cover opacity-80"
        />
        <div className="absolute inset-0 vignette" />
        <div className="absolute inset-0 smoke pointer-events-none" />
        <div className="absolute inset-0 spotlight pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/65 to-background" />
      </div>
      <DustParticles count={55} />

      <header className="relative z-10 px-4 sm:px-6 md:px-12 pt-6 sm:pt-8 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full border border-[color:var(--gold)]/40 glow-gold flex items-center justify-center">
            <span className="font-display text-gold text-lg">ॐ</span>
          </div>
          <div>
            <div className="font-display text-xl text-gold leading-none">Taalriya</div>
            <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Classical Riyaaz Studio
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <nav className="glass rounded-full p-1 flex items-center gap-1 overflow-x-auto max-w-full">
            {VIEWS.map((v) => {
              const active = v.id === view;
              const locked = v.premium && tier !== "premium";
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={[
                    "rounded-full px-3 sm:px-4 py-1.5 text-xs sm:text-sm transition whitespace-nowrap inline-flex items-center gap-1",
                    active
                      ? "bg-[color:var(--gold)] text-[color:var(--primary-foreground)]"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {v.label}
                  {locked && <Lock className="h-3 w-3 opacity-70" />}
                </button>
              );
            })}
          </nav>
          <UserMenu />
        </div>
      </header>

      <section className="relative z-10 px-4 sm:px-6 md:px-12 pt-10 md:pt-16 pb-8 text-center max-w-4xl mx-auto">
        <h1 className="font-display text-3xl sm:text-5xl md:text-7xl leading-[1.05] text-gold animate-fade-up">
          The rhythm of riyaaz,<br className="hidden md:block" /> in your hands.
        </h1>
        <p
          className="mt-4 sm:mt-5 text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto animate-fade-up"
          style={{ animationDelay: "0.1s" }}
        >
          Your tabla, your tanpura, your scale. A cinematic riyaaz companion for Indian
          classical singers — every bol, your own.
        </p>
      </section>

      <div className="relative z-10 px-3 sm:px-4 md:px-12 pb-24 max-w-6xl mx-auto">
        {view === "taals" && (
          <>
            {favorites.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 justify-center">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Favorites</span>
                {favorites.map((id) => {
                  const t = TAALS.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => { setActiveTaalId(id); setVariation("theka"); }}
                      className="rounded-full px-3 py-1 text-xs border border-[color:var(--gold)]/40 text-gold bg-[color:var(--accent)]/40 hover:glow-gold transition"
                    >
                      ★ {t.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 mb-5">
              {TAALS.map((t) => {
                const active = t.id === activeTaalId;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTaalId(t.id); setVariation("theka"); }}
                    className={[
                      "rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm border transition",
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

            <div className="text-center text-xs text-muted-foreground mb-5 px-4">
              <span className="font-display text-sm sm:text-base text-foreground/80">{activeTaal.name}</span>
              {" · "}{activeTaal.beats} beats ({activeTaal.divisions}) · {activeTaal.description}
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {VARIATION_KEYS.map((key) => {
                const active = key === variation;
                return (
                  <button
                    key={key}
                    onClick={() => setVariation(key)}
                    className={[
                      "rounded-full px-3 py-1.5 text-[11px] sm:text-xs uppercase tracking-wider border transition",
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

            {/* Tabla tuning */}
            <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
              <span className="uppercase tracking-wider">Tabla tuning</span>
              <input
                type="range" min={-12} max={12} step={1} value={tablaST}
                onChange={(e) => setTablaST(Number(e.target.value))}
                className="w-44 accent-[color:var(--gold)]"
              />
              <span className="tabular-nums w-16 text-foreground">
                {tablaST > 0 ? `+${tablaST}` : tablaST} st
              </span>
              {tablaST !== 0 && (
                <button
                  onClick={() => setTablaST(0)}
                  className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  reset
                </button>
              )}
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
              subtitle={`${activeTaal.beats} beat cycle · ${activeTaal.divisions} · Sam on ${activeTaal.sam}${activeTaal.khali.length ? `, Khali on ${activeTaal.khali.join(", ")}` : ""}`}
              divisions={divisions}
              sam={activeTaal.sam}
              khali={activeTaal.khali}
              taalId={activeTaal.id}
              isFavorite={isFav}
              onToggleFavorite={toggleFav}
            />
          </>
        )}

        {view === "tanpura" && (
          tier === "premium" ? (
            <TanpuraPanel scale={tanpuraScale} onScaleChange={setTanpuraScale} />
          ) : (
            <PremiumLock
              title="Tanpura is a Premium feature"
              body="Drone your sa with a custom-pitched tanpura that follows your scale. Sign in and upgrade to unlock continuous looping with smooth scale shifting."
              isSignedIn={Boolean(user)}
            />
          )
        )}
        {view === "custom" && <CustomTaalCreator tier={tier} />}
        {view === "sounds" && <SoundLibrary />}
      </div>

      <footer className="relative z-10 px-6 pb-8 text-center text-xs text-muted-foreground/70">
        Space to play · ←/→ to nudge BPM · Crafted for riyaaz.
      </footer>
    </main>
  );
}
