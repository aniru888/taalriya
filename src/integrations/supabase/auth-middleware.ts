import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      return next({
        context: { supabase: null, userId: 'anonymous', claims: null },
      });
    }

    const request = getRequest();
    const authHeader = request?.headers?.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return next({
        context: { supabase: null, userId: 'anonymous', claims: null },
      });
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      }
    );

    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (error || !data?.claims?.sub) {
        return next({
          context: { supabase: null, userId: 'anonymous', claims: null },
        });
      }
      return next({
        context: { supabase, userId: data.claims.sub, claims: data.claims },
      });
    } catch {
      return next({
        context: { supabase: null, userId: 'anonymous', claims: null },
      });
    }
  },
);
