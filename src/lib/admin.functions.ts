import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- internal helpers ----------
async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("owner")) {
    throw new Error("Forbidden: admin role required");
  }
  return roles as ("owner" | "admin" | "user")[];
}

async function assertOwner(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "owner")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: owner role required");
}

// ---------- role status (called by client to know what to render) ----------
export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role as "owner" | "admin" | "user");
    return {
      roles,
      isOwner: roles.includes("owner"),
      isAdmin: roles.includes("owner") || roles.includes("admin"),
    };
  });

// ---------- library sounds CRUD ----------
const SoundUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  bpm: z.number().int().min(20).max(400).nullable().optional(),
  scale: z.string().max(8).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  taal_name: z.string().max(60).nullable().optional(),
  is_featured: z.boolean().optional(),
});

const SoundCreateSchema = z.object({
  kind: z.enum(["bol", "tanpura", "taal_loop"]),
  name: z.string().min(1).max(120),
  storage_path: z.string().min(1).max(500),
  duration_ms: z.number().int().min(0).max(3_600_000).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  bpm: z.number().int().min(20).max(400).nullable().optional(),
  scale: z.string().max(8).nullable().optional(),
  category: z.string().max(60).nullable().optional(),
  taal_name: z.string().max(60).nullable().optional(),
  is_featured: z.boolean().default(false),
});

export const listLibrarySounds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("library_sounds")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { sounds: data ?? [] };
  });

export const createLibrarySound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SoundCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("library_sounds")
      .insert({ ...data, uploaded_by: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { sound: row };
  });

export const updateLibrarySound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SoundUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { data: row, error } = await supabaseAdmin
      .from("library_sounds")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { sound: row };
  });

export const deleteLibrarySound = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // fetch storage path first to clean up
    const { data: existing } = await supabaseAdmin
      .from("library_sounds")
      .select("storage_path")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("library_sounds").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (existing?.storage_path) {
      await supabaseAdmin.storage.from("sound-library").remove([existing.storage_path]);
    }
    return { ok: true };
  });

/** Returns a signed upload URL the admin client uses to PUT a file directly to storage. */
export const createSignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        kind: z.enum(["bol", "tanpura", "taal_loop"]),
        filename: z.string().min(1).max(200).regex(/^[a-zA-Z0-9._\- ]+$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const safe = data.filename.replace(/\s+/g, "_");
    const path = `${data.kind}/${crypto.randomUUID()}-${safe}`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("sound-library")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path: signed.path, token: signed.token };
  });

/** Returns a short-lived signed URL to download/play a stored sound. */
export const getSoundPlaybackUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ path: z.string().min(1).max(500) }).parse(input))
  .handler(async ({ data }) => {
    const { data: signed, error } = await supabaseAdmin.storage
      .from("sound-library")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ---------- admin requests + role management ----------
export const createAdminRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ message: z.string().max(1000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // prevent duplicate pending requests
    const { data: existing } = await supabaseAdmin
      .from("admin_requests")
      .select("id")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true, alreadyPending: true };
    const { error } = await supabaseAdmin.from("admin_requests").insert({
      user_id: context.userId,
      message: data.message ?? null,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true, alreadyPending: false };
  });

export const listAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { data: reqs, error } = await supabaseAdmin
      .from("admin_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // hydrate user info
    const userIds = Array.from(new Set((reqs ?? []).map((r) => r.user_id)));
    const profileMap: Record<string, { email: string | null; display_name: string | null }> = {};
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, display_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        profileMap[p.id] = { email: p.email, display_name: p.display_name };
      }
    }
    return {
      requests: (reqs ?? []).map((r) => ({
        ...r,
        profile: profileMap[r.user_id] ?? null,
      })),
    };
  });

export const reviewAdminRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { data: req, error: rErr } = await supabaseAdmin
      .from("admin_requests")
      .select("user_id, status")
      .eq("id", data.id)
      .single();
    if (rErr) throw new Error(rErr.message);
    if (req.status !== "pending") throw new Error("Request already reviewed");

    if (data.approve) {
      const { error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: req.user_id, role: "admin", granted_by: context.userId });
      if (roleErr && !roleErr.message.includes("duplicate")) throw new Error(roleErr.message);
    }
    const { error: updErr } = await supabaseAdmin
      .from("admin_requests")
      .update({
        status: data.approve ? "approved" : "rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, created_at, granted_by")
      .in("role", ["admin", "owner"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    const { data: profiles } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, email, display_name")
          .in("id", userIds)
      : { data: [] as Array<{ id: string; email: string | null; display_name: string | null }> };
    const map = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    return {
      admins: (data ?? []).map((r) => ({
        ...r,
        profile: map[r.user_id] ?? null,
      })),
    };
  });

export const demoteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    if (data.user_id === context.userId) throw new Error("Owners cannot demote themselves");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- taal beat assignments (global, admin-curated) ----------
export const listTaalAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("taal_assignments")
      .select("id, taal_id, variation, beat_index, slot_index, sound_id, offset, velocity");
    if (error) throw new Error(error.message);
    return { assignments: data ?? [] };
  });

const AssignmentUpsertSchema = z.object({
  taal_id: z.string().min(1).max(60),
  variation: z.string().min(1).max(40),
  beat_index: z.number().int().min(0).max(63),
  slot_index: z.number().int().min(0).max(7),
  sound_id: z.string().uuid(),
  offset: z.number().min(0).max(0.999).default(0),
  velocity: z.number().min(0).max(2).default(1),
});

export const upsertTaalAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => AssignmentUpsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("taal_assignments")
      .upsert(
        { ...data, created_by: context.userId },
        { onConflict: "taal_id,variation,beat_index,slot_index" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { assignment: row };
  });

export const deleteTaalAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("taal_assignments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
