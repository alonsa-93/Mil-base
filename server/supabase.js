import { createClient } from '@supabase/supabase-js';

// ── CRITICAL: Backend always uses SERVICE_ROLE_KEY ──────────────────────────
// SERVICE_ROLE_KEY bypasses Row Level Security entirely.
// This is correct for a trusted backend — Express handles auth/authz.
// NEVER expose this key to the frontend.
//
// ANON_KEY is only for frontend realtime subscriptions.
// ─────────────────────────────────────────────────────────────────────────────

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

// Strip /rest/v1/ suffix if accidentally included in env
const baseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '');

export const supabase = createClient(baseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

// Initialize function — verifies connection on startup
export async function initDb() {
  const { error } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
    throw error;
  }

  console.log('✅ Supabase connected (service role)');
}
