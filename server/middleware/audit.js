import { getDb } from '../database.js';

export function logAction({ userId, username, action, entityType, entityId, oldValue, newValue, ip }) {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, old_value, new_value, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId ?? null,
      username ?? null,
      action,
      entityType,
      entityId ? String(entityId) : null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ip ?? null
    );
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}
