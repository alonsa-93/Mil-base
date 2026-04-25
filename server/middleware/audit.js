import { supabase } from '../supabase.js';

export async function logAction({ userId, username, action, entityType, entityId, oldValue, newValue, ip }) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId ?? null,
      username: username ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip: ip ?? null
    });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}
