import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://afvtqoomzwwuatqxfnki.supabase.co/rest/v1/';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_TKHzMqw4ox1HZdowGyejgA_xf33erh_';

// Remove /rest/v1/ from URL if present (we'll add it back only when needed)
const baseUrl = supabaseUrl.replace('/rest/v1/', '');

export const supabase = createClient(baseUrl, supabaseKey);

// Helper function for API queries
export async function query(table, options = {}) {
  let q = supabase.from(table).select(options.select || '*');

  if (options.eq) {
    Object.entries(options.eq).forEach(([key, value]) => {
      q = q.eq(key, value);
    });
  }
  if (options.order) {
    q = q.order(options.order, { ascending: options.ascending !== false });
  }
  if (options.limit) {
    q = q.limit(options.limit);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

// Helper function for insert
export async function insert(table, data) {
  const { data: result, error } = await supabase
    .from(table)
    .insert(data)
    .select();

  if (error) throw error;
  return result;
}

// Helper function for update
export async function update(table, data, eq) {
  let q = supabase.from(table).update(data);

  Object.entries(eq).forEach(([key, value]) => {
    q = q.eq(key, value);
  });

  const { data: result, error } = await q.select();
  if (error) throw error;
  return result;
}

// Helper function for delete
export async function deleteRecord(table, eq) {
  let q = supabase.from(table).delete();

  Object.entries(eq).forEach(([key, value]) => {
    q = q.eq(key, value);
  });

  const { error } = await q;
  if (error) throw error;
  return true;
}

// Initialize function (checks connection)
export async function initDb() {
  try {
    const { data, error } = await supabase.from('users').select('count()', { count: 'exact' }).limit(1);
    if (error) throw error;
    console.log('✅ Supabase connected');
    return true;
  } catch (e) {
    console.error('❌ Supabase connection failed:', e.message);
    throw e;
  }
}
