
## Goals

Tighten the rhythm engine so visuals follow the audio clock, loops stay locked to the BPM grid, and admin uploads only enter practice when an admin explicitly assigns them. Add subdivision support (multiple bols per matra).

## 1. New audio scheduler (`src/lib/tabla-audio.ts`)

Replace Tone.js-driven `Tone.Sequence` + `Tone.Draw` with a custom **lookahead scheduler** built directly on `AudioContext` (the proven Web Audio API pattern: 25ms setInterval, 100ms lookahead window, schedule events at exact `audioContext.currentTime + offset`).

- Single shared `AudioContext` + master gain → **DynamicsCompressorNode** (soft-knee tabla limiter) → destination. Compressor is bypassable via a setting.
- Maintain a `nextNoteTime` cursor in audio-clock seconds. Each tick schedules every event whose start time falls inside the lookahead, including sub-beat subdivisions.
- Emit a `visualQueue` of `{ stepIndex, subIndex, audioTime }` entries; a `requestAnimationFrame` loop pops entries when `audioContext.currentTime >= audioTime` and calls a subscriber. **Beat glow now fires exactly when the sample starts** — visuals follow the audio clock, never lead it.
- Per-sample playback uses a fresh `AudioBufferSourceNode` with `start(audioTime)` (sample-accurate). Each buffer is **pre-normalized at decode time** (peak-normalize to -1 dBFS, store gain factor in metadata) so soft uploads are loud and clear without clipping. Apply a 3 ms fade-in / 5 ms fade-out via a per-voice `GainNode` to kill clicks at loop seams.
- Voice manager: cap concurrent voices per step (default 2). Cancel any voice still running from the previous cycle before starting the next — prevents stacking/drift after long loops.
- Tempo changes apply at the next bar boundary, never mid-beat, so loops stay quantised.

API the UI uses:
```ts
startTransport({ bpm, steps, loop, onBeat })   // returns stop()
setBpm(bpm)                                    // ramps at next bar
setCompressorEnabled(b)
```
Where each `Step` is `{ bols: { sampleId, offset: 0..1, velocity }[] }` — `offset` is the fractional position inside the matra (0 = downbeat, 0.5 = mid-subdivision, etc.). Two bols at offsets 0 and 0.5 give "Ti + Ti"; three at 0, 0.33, 0.66 give a triplet. Offsets are computed from grid positions so they stay mathematically locked to BPM.

## 2. TaalPlayer rewrite (`src/components/TaalPlayer.tsx`)

- Replace the Tone.Sequence block with `startTransport` from the new scheduler.
- `onBeat({ stepIndex, subIndex })` sets local state used to drive the glow; the glow CSS keeps `transition-none` so it lights instantly on the audio callback, no UI-timer lag.
- Render subdivisions inside each beat cell: when `step.bols.length > 1`, show a small inner grid of bol labels with a sub-glow indicator.
- Keep existing favourites / trainer / session timer UI untouched.

## 3. Step model + admin assignment

Promote the per-beat model from `string | null` to:

```ts
type Bol = { sampleId: string | null; label: string; offset: number; velocity?: number }
type Step = { bols: Bol[] }   // 1..N bols per matra
```

- `src/lib/taals.ts` and `src/lib/sample-store.ts`: migrate built-in taals + stored custom taals to the new shape (backwards-compatible loader: old `string` becomes `{ bols: [{ label: x, sampleId: null, offset: 0 }] }`).
- `CustomTaalCreator.tsx`: per-beat cell gets a "+" button to add a subdivision; subdivisions snap to 1/2, 1/3, 1/4 grid positions selectable per beat. Removing a bol leaves the matra count unchanged.

**Critical fix for the auto-attach bug:** today uploaded recordings are matched to beat labels by name in `tabla-audio.findByName`, so any upload called "Dha" silently rewires every "Dha" beat. Remove that name-based auto-binding. New rule: a bol only plays a sample when its `sampleId` is set explicitly (by the admin in the library editor, or by the user in CustomTaalCreator's bol picker). Uploads land in the library inventory and stay there until assigned.

## 4. Admin: explicit assignment + multi-bol uploads

- Extend the `SoundUploader` form already used at `/admin/sounds` with required selectors when `kind = "bol"`:
  - Target taal (from `library_taals` + built-ins)
  - Beat number (1..N for that taal)
  - Subdivision slot (1/1, 1/2, 1/3, 1/4 and which position)
  - BPM-compatibility range (min/max BPM the recording sounds natural at)
- New table column on `library_sounds`: `assignment jsonb` storing `{ taalId, beat, subdivision, position, bpmMin, bpmMax }`. Server fn validates that the slot is free or the admin confirms a second bol in the same matra. Migration adds the column with default `null` so existing rows keep working.
- `SoundLibraryManager` shows the assignment chip and lets admins edit/clear it. Unassigned recordings never appear in practice.

## 5. Quality & performance

- Normalize on decode (peak gain calc once, cached in `library_sounds.peak_db`).
- Pre-warm all assigned buffers when a taal loads so playback start is gapless.
- Optional EQ tilt (+2 dB @ 4 kHz BiquadFilter "peaking") on the master bus for tabla clarity, behind a settings toggle.
- Dispose nodes after their tail; nothing kept alive between cycles → no memory creep.
- Mobile: resume `AudioContext` on first user gesture (Play button) — existing `startAudio()` already does this; we keep that contract.

## 6. Visual / audio timing separation

The scheduler is the single source of truth. `currentBeat` state is only ever written from `onBeat`, which fires from the rAF visual queue keyed to `audioContext.currentTime`. No more `setTimeout`, `setInterval`, or `Tone.Draw` driving the UI.

## Files touched

- New: `src/lib/audio-engine.ts` (scheduler + voice manager)
- Rewrite: `src/lib/tabla-audio.ts` (thin facade over the new engine, keeps existing imports working)
- Rewrite: `src/components/TaalPlayer.tsx`
- Edit: `src/components/CustomTaalCreator.tsx`, `src/lib/taals.ts`, `src/lib/sample-store.ts`, `src/lib/cloud-sync.ts` (Step shape migration)
- Edit: `src/components/admin/SoundUploader.tsx`, `SoundLibraryManager.tsx`, `src/lib/admin.functions.ts` (assignment fields)
- Migration: `library_sounds.assignment jsonb`, `library_sounds.peak_db real`

## What stays the same

Login, admin gating, role system, Supabase tables, storage bucket, routes, UI layout, theme tokens. No behaviour changes outside the audio path and the admin upload form.
