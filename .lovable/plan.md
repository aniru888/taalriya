# Admin System, Shared Library & Cinematic Login

## 1. Roles & Owner Model

**Database (new migration):**
- Enum `app_role` = `owner | admin | user`
- Table `user_roles (id, user_id, role, created_at, granted_by)` with UNIQUE(user_id, role), RLS enabled
- `has_role(_user_id uuid, _role app_role)` — SECURITY DEFINER, used in all policies (no recursion)
- `is_admin(_user_id uuid)` — true if user has `admin` OR `owner`
- Table `admin_requests (id, user_id, status [pending|approved|rejected], message, created_at, reviewed_by, reviewed_at)` — users request access, owner approves
- RLS rules:
  - `user_roles`: anyone can read their own roles; only **owner** can INSERT/UPDATE/DELETE other users' roles (via `has_role(auth.uid(), 'owner')`)
  - `admin_requests`: user can insert/view their own; owner sees all and updates status

**Bootstrap owner**: After migration approval, I'll give you the exact `supabase--insert` query to make YOUR account the owner. No automatic promotion. No "first user is owner" trick.

## 2. Shared Sound Library

**Storage bucket** `sound-library` (private) with RLS:
- SELECT: any authenticated user (so the app can fetch & cache)
- INSERT/UPDATE/DELETE: only `is_admin(auth.uid())`

**Table `library_sounds`** (admin-managed, all users read):
- `id, kind` (enum: `bol | tanpura | taal_loop`)
- `name, description, tags text[]`
- `bpm int?, scale text?, category text?, taal_name text?`
- `storage_path, duration_ms, is_featured bool`
- `uploaded_by uuid, created_at, updated_at`
- RLS: SELECT for authenticated; INSERT/UPDATE/DELETE only `is_admin()`

**Table `library_taals`** (admin-curated preset compositions): same shape as `user_taals` + `is_featured`, admin-only writes.

Per-category control: admin toggles `is_featured` per upload to decide what surfaces by default vs. opt-in.

## 3. Admin Dashboard `/admin`

Protected via `_authenticated/admin.tsx` layout + `beforeLoad` calling a `requireAdmin` server fn (throws redirect to `/` if not admin). Owner-only sub-page `/admin/users` has its own `requireOwner` gate.

Tabs:
- **Sound Library**: list + drag-drop uploader (uses existing shadcn patterns + native HTML5 DnD), waveform preview (lightweight: AudioContext + canvas, no extra deps), edit metadata, delete
- **Taal Loops**: same UI shape for full-loop recordings
- **Tanpura Library**: list/upload tanpura recordings to shared bucket
- **Admin Management** (owner only): list pending `admin_requests`, approve/reject; list current admins; promote/demote; cannot demote owner

Server functions (all in `src/lib/admin.functions.ts`):
- `requireAdmin`, `requireOwner` middleware-style gates
- `listLibrarySounds`, `uploadLibrarySound` (signed upload URL flow), `updateLibrarySound`, `deleteLibrarySound`
- `listAdminRequests`, `approveAdminRequest`, `rejectAdminRequest`, `demoteAdmin`

## 4. User-Facing Changes

- `SoundLibrary.tsx`, `TanpuraPanel.tsx`, taal selector now fetch `library_*` rows for everyone and overlay user's private bols on top
- Normal users see **no** upload UI, **no** delete/edit controls for library items
- Add a "Request admin access" link in `UserMenu` → opens dialog that inserts `admin_requests` row
- Admin badge in `UserMenu` for admins/owner, plus "Admin Dashboard" link

## 5. Cinematic Login Redesign

- Generate new 1920x1080 hero: two realistic tablas, warm golden rim-light, dramatic shadow falloff, smoky studio, suspended powder particles — saved as `src/assets/login-hero.jpg`
- Login card: stronger glass morphism (backdrop-blur-2xl, gradient border via `--gold`, inner highlight), subtle scale-in animation, dust particle layer at higher density
- Keep all existing auth logic untouched (email/password + Google broker)

## 6. Tech & Security Notes

- All writes go through server fns with `requireSupabaseAuth` + role check, **never** trust client-side `isAdmin` for gating actions
- RLS is the backstop — policies use `has_role()` so even a bypass attempt at the API level is denied
- Self-promotion is impossible: `user_roles` INSERT policy requires caller to be owner
- Storage uploads go through a server fn that validates admin, then issues a signed upload URL — direct bucket writes from client are blocked by RLS

## File Plan

**New migrations**: 1 file with enums, `user_roles`, `admin_requests`, `library_sounds`, `library_taals`, functions, RLS, storage bucket + policies

**New files**:
- `src/lib/admin.functions.ts`, `src/lib/library.functions.ts`
- `src/hooks/useRole.ts`
- `src/routes/_authenticated.tsx` (auth gate layout)
- `src/routes/_authenticated/admin.tsx` (admin layout + tabs)
- `src/routes/_authenticated/admin/sounds.tsx`, `/admin/taals.tsx`, `/admin/tanpura.tsx`, `/admin/users.tsx`
- `src/components/admin/SoundUploader.tsx` (drag-drop + waveform)
- `src/components/admin/WaveformPreview.tsx`
- `src/components/RequestAdminDialog.tsx`
- `src/assets/login-hero.jpg` (generated)

**Edited**:
- `src/routes/login.tsx` (new hero, stronger glass)
- `src/components/UserMenu.tsx` (admin link, request dialog)
- `src/components/SoundLibrary.tsx`, `TanpuraPanel.tsx`, `CustomTaalCreator.tsx` (merge shared library; hide admin controls for non-admins)
- `src/lib/cloud-sync.ts` (sync admin status into local cache)

## What I'll Need From You

After migration approval, I'll run **one** `supabase--insert` query to make your current account the owner. Tell me your account email so I target the right `auth.users` row. (Or sign up first, then tell me which email — you can do this right after I ship.)
