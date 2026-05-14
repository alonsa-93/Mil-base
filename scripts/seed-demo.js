/**
 * seed-demo.js — Seeds the database with realistic demo data.
 *
 *   Run with:  npm run seed
 *   or:        node scripts/seed-demo.js
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.
 *
 * Idempotent: deletes existing demo rows first (matched by demo markers),
 * then re-inserts. Safe to run multiple times.
 *
 * Seeds:
 *   - 8  users  (1 mag"d, 2 mefakdim, 1 ras"p, 2 samalim, 2 lohamim)  — password "1234"
 *   - 30 soldiers (varied roles, statuses, companies, sizes, diets)
 *   - 13 equipment items (across all categories, some short on stock)
 *   - 16 missions (past, present, future; varied urgencies/types/statuses)
 *   - ~22 mission assignments
 *   - ~25 equipment issuances (some active, some returned)
 *   - 9 ration requests (last week + next 3 days)
 *
 * Personal soldier_equipment rows are created automatically by the
 * service layer when soldiers are inserted via the create() RPC path —
 * but since this seed inserts directly, we add them explicitly.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

// ─── Setup ────────────────────────────────────────────────────────────────────
const url  = process.env.SUPABASE_URL;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || url.includes('YOUR_') || !key || key.includes('YOUR_')) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured in .env');
  console.error('   Fill in the real values before running the seed.');
  process.exit(1);
}

const supabase = createClient(url.replace(/\/rest\/v1\/?$/, ''), key, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

// ─── Demo data ────────────────────────────────────────────────────────────────
const PASSWORD = '1234';

const FIRST_NAMES_M = ['אדם', 'יואב', 'נועם', 'איתי', 'דניאל', 'אורי', 'רון', 'יונתן', 'גיא', 'אופיר', 'תומר', 'עידן', 'אבי', 'ניר', 'אסף', 'אריאל', 'מתן', 'יהונתן'];
const FIRST_NAMES_F = ['שרה', 'נעמה', 'רינה', 'מיכל', 'תמר', 'הדס', 'נועה', 'שירה', 'יעל', 'ליאת', 'אביגיל'];
const LAST_NAMES    = ['כהן', 'לוי', 'מור', 'דוד', 'אבי', 'שמש', 'פרץ', 'ביטון', 'אלון', 'מזרחי', 'סולומון', 'פרידמן', 'בן-דוד', 'גולן', 'אזולאי', 'ברק', 'נחום', 'יוסף'];

const MIL_SIZES         = ['ק', 'ב', 'ג', 'מ', 'ממ'];
const CIVIL_SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const CIVIL_PANTS_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const STATUSES          = ['זמין', 'זמין', 'זמין', 'במשימה', 'מנוחה', 'חופשה', 'אחר']; // weighted
const COMPANIES         = ['א', 'ב', 'ג'];
const TEAMS             = ['1', '2', '3', '4', '5', '6'];

// Default soldier_equipment item types (mirrors soldierService.DEFAULT_EQUIPMENT)
const DEFAULT_EQ_TYPES = ['weapon', 'vest', 'helmet', 'magazines', 'knee_pads', 'medical_kit'];

const pick   = arr => arr[Math.floor(Math.random() * arr.length)];
const rand   = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const chance = p => Math.random() < p;

// ─── Step 1: hash one password for all demo users ─────────────────────────────
const passwordHash = bcrypt.hashSync(PASSWORD, 10);

// ─── Step 2: USERS ────────────────────────────────────────────────────────────
const USERS = [
  { username: 'magad1',   role: 'magad',   full_name: 'מג"ד יוסי כהן',         phone: '050-1111111' },
  { username: 'mefaked1', role: 'mefaked', full_name: 'מ"פ א׳ — סרן רוני לוי',  phone: '050-2222222' },
  { username: 'mefaked2', role: 'mefaked', full_name: 'מ"פ ב׳ — סרן מיכל אבי', phone: '050-3333333' },
  { username: 'rasap1',   role: 'rasap',   full_name: 'רס"פ דניאל גל',          phone: '050-4444444' },
  { username: 'samal1',   role: 'samal',   full_name: 'סמ"פ א׳ — שי כהן',       phone: '050-5555555' },
  { username: 'samal2',   role: 'samal',   full_name: 'סמ"פ ב׳ — נעמה שר',      phone: '050-6666666' },
  { username: 'lohem1',   role: 'lohem',   full_name: 'טור׳ אדם לוי',           phone: '050-7777771' },
  { username: 'lohem2',   role: 'lohem',   full_name: 'טור׳ שרה מור',            phone: '050-7777772' },
].map(u => ({ ...u, password: passwordHash }));

// ─── Step 3: SOLDIERS — 30, with varied parameters ───────────────────────────
function buildSoldier(i) {
  // 5 senior, rest lohamim — varied roles
  let role;
  if (i === 0) role = 'magad';
  else if (i < 3) role = 'mefaked';
  else if (i < 5) role = 'rasap';
  else if (i < 10) role = 'samal';
  else role = 'lohem';

  const gender = chance(0.3) ? 'נקבה' : 'זכר';
  const first  = gender === 'נקבה' ? pick(FIRST_NAMES_F) : pick(FIRST_NAMES_M);
  const last   = pick(LAST_NAMES);

  return {
    serial_num: i + 1,
    personal_id:  String(7000000 + i * 137 + 11),
    full_name:    `${first} ${last}`,
    role,
    status:       pick(STATUSES),
    phone:        `050-${String(1000000 + rand(0, 8999999)).slice(0, 7)}`,
    company:      pick(COMPANIES),
    team:         pick(TEAMS),
    gender,
    mil_shirt:    pick(MIL_SIZES),
    mil_pants:    pick(MIL_SIZES),
    mil_boots:    String(rand(36, 47)),
    civil_shirt:  pick(CIVIL_SHIRT_SIZES),
    civil_pants:  pick(CIVIL_PANTS_SIZES),
    is_vegan:           chance(0.10) ? 1 : 0,
    is_vegetarian:      chance(0.18) ? 1 : 0,
    lactose_intolerant: chance(0.12) ? 1 : 0,
    gluten_free:        chance(0.08) ? 1 : 0,
    nutrition_notes:    chance(0.2) ? 'אלרגיה לבוטנים' : null,
    total_guard_hours:    rand(0, 80),
    total_mission_hours:  rand(0, 120),
  };
}

const SOLDIERS = Array.from({ length: 30 }, (_, i) => buildSoldier(i));

// ─── Step 4: EQUIPMENT items ─────────────────────────────────────────────────
const EQUIPMENT = [
  { name: 'קסדה',              category: 'ציוד מגן',    total_quantity: 40, available_quantity: 28, min_required: 30 }, // gap
  { name: 'אפוד',              category: 'ציוד מגן',    total_quantity: 40, available_quantity: 35, min_required: 30 },
  { name: 'ברכיות',            category: 'ציוד מגן',    total_quantity: 60, available_quantity: 52, min_required: 30 },
  { name: 'מקלע נגב',          category: 'נשק',          total_quantity:  8, available_quantity:  6, min_required:  6 },
  { name: 'נשק M4',             category: 'נשק',          total_quantity: 45, available_quantity: 38, min_required: 30 },
  { name: 'מחסניות',            category: 'נשק',          total_quantity: 300, available_quantity: 245, min_required: 200 },
  { name: 'מכשיר קשר',          category: 'תקשורת',       total_quantity: 12, available_quantity:  9, min_required: 10 }, // gap
  { name: 'מכשיר מוטורולה',     category: 'תקשורת',       total_quantity: 25, available_quantity: 20, min_required: 15 },
  { name: 'מים (6 ליטר)',       category: 'לוגיסטיקה',    total_quantity: 80, available_quantity: 60, min_required: 60 },
  { name: 'מנת קרב',           category: 'לוגיסטיקה',    total_quantity: 100, available_quantity: 88, min_required: 60 },
  { name: 'אלונקה',             category: 'רפואה',         total_quantity:  6, available_quantity:  5, min_required:  4 },
  { name: 'חסם עורקים',         category: 'רפואה',         total_quantity: 40, available_quantity: 30, min_required: 40 }, // gap
  { name: 'פנס לילה',           category: 'אחר',           total_quantity: 50, available_quantity: 41, min_required: 30 },
];

// ─── Step 5: MISSIONS ────────────────────────────────────────────────────────
function buildMissions() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const mk = (offsetStartHours, durationHours, fields) => {
    const start = new Date(now.getTime() + offsetStartHours * 3600 * 1000);
    const end   = new Date(start.getTime() + durationHours * 3600 * 1000);
    return { start_time: start.toISOString(), end_time: end.toISOString(), ...fields };
  };

  return [
    mk(-72, 8,  { title: 'שמירת בסיס - ראשון',  type: 'שמירה',      urgency: 'רגיל',   status: 'הסתיים', location: 'שער ראשי',     required_count: 2 }),
    mk(-48, 6,  { title: 'סיור לילה - מסלול 1',  type: 'סיור',       urgency: 'דחוק',   status: 'הסתיים', location: 'גבול צפון',    required_count: 3 }),
    mk(-24, 12, { title: 'אבטחת מתחם רפואי',     type: 'אבטחה',      urgency: 'רגיל',   status: 'הסתיים', location: 'בית חולים',    required_count: 4 }),
    mk(-12, 8,  { title: 'אימון ירי בוקר',       type: 'אימון',      urgency: 'רגיל',   status: 'פעיל',    location: 'מטווח',        required_count: 6 }),
    mk(  0, 8,  { title: 'שמירת שער ראשי',       type: 'שמירה',      urgency: 'רגיל',   status: 'פעיל',    location: 'שער ראשי',     required_count: 2 }),
    mk(  2, 10, { title: 'סיור בוקר - מסלול 2',  type: 'סיור',       urgency: 'רגיל',   status: 'מתוכנן', location: 'מסלול ירוק',   required_count: 3 }),
    mk(  6, 4,  { title: 'תרגול חירום',          type: 'אימון',      urgency: 'חירום', status: 'מתוכנן', location: 'מתחם הבסיס',   required_count: 8 }),
    mk(  8, 8,  { title: 'שמירה לילית A',         type: 'שמירה',      urgency: 'רגיל',   status: 'מתוכנן', location: 'עמדה דרומית',  required_count: 2 }),
    mk( 24, 12, { title: 'אבטחת אירוע VIP',      type: 'אבטחה',      urgency: 'דחוק',   status: 'מתוכנן', location: 'אולם כינוסים', required_count: 5 }),
    mk( 30, 6,  { title: 'הובלת ציוד',           type: 'לוגיסטיקה',  urgency: 'רגיל',   status: 'מתוכנן', location: 'מחסן מרכזי',   required_count: 2, vehicle: 'משאית מ-26' }),
    mk( 48, 24, { title: 'תרגיל פלוגתי',          type: 'אימון',      urgency: 'רגיל',   status: 'מתוכנן', location: 'שטח אש',        required_count: 12 }),
    mk( 72, 8,  { title: 'סיור גבול - שגרתי',    type: 'סיור',       urgency: 'רגיל',   status: 'מתוכנן', location: 'גבול מזרח',    required_count: 3 }),
    mk(120, 8,  { title: 'שמירת בסיס - מחר',    type: 'שמירה',      urgency: 'רגיל',   status: 'מתוכנן', location: 'שער דרום',     required_count: 2 }),
    mk(168, 6,  { title: 'משימה מיוחדת',         type: 'אחר',         urgency: 'חירום', status: 'מתוכנן', location: 'נקודה 4',       required_count: 6 }),
    mk(192, 8,  { title: 'הדרכת לוחמים חדשים',  type: 'אימון',      urgency: 'רגיל',   status: 'מתוכנן', location: 'אולם הדרכה',   required_count: 4 }),
    mk(240, 4,  { title: 'בדיקת ציוד תקופתית',  type: 'לוגיסטיקה',  urgency: 'רגיל',   status: 'בוטל',    location: 'מחסן',          required_count: 2 }),
  ];
}

// ─── Step 6: RATIONS — last week + 3 next days ────────────────────────────────
function buildRations() {
  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  const rations = [];
  for (let offset = -4; offset <= 3; offset++) {
    const d = new Date(today.getTime() + offset * 86400000);
    rations.push({
      date: fmt(d),
      meal_type: 'ארוחת בוקר',
      total_count:        rand(25, 30),
      vegan_count:        rand(1, 3),
      vegetarian_count:   rand(3, 6),
      lactose_free_count: rand(2, 4),
      gluten_free_count:  rand(1, 2),
      notes: offset === 0 ? 'הזמנה רגילה' : null,
    });
    if (offset >= -2) {
      rations.push({
        date: fmt(d),
        meal_type: 'ארוחת צהריים',
        total_count:        rand(25, 30),
        vegan_count:        rand(1, 3),
        vegetarian_count:   rand(3, 6),
        lactose_free_count: rand(2, 4),
        gluten_free_count:  rand(1, 2),
        notes: null,
      });
    }
  }
  return rations;
}

// ─── Step 7: helpers ─────────────────────────────────────────────────────────
async function clearTables() {
  console.log('🗑  Clearing existing demo data…');
  // Order matters — FKs cascade down from soldiers/missions
  for (const tbl of [
    'equipment_assignments',
    'soldier_equipment',
    'assignments',
    'rations_requests',
    'missions',
    'equipment_items',
    'soldiers',
    'users',
  ]) {
    const { error } = await supabase.from(tbl).delete().gt('id', 0);
    if (error && !error.message.includes('does not exist')) {
      console.warn(`   ⚠ ${tbl}: ${error.message}`);
    } else {
      console.log(`   ✓ ${tbl}`);
    }
  }
}

async function insertReturning(table, rows, label) {
  if (!rows.length) return [];
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) {
    console.error(`❌ insert ${label || table} failed:`, error.message);
    throw error;
  }
  console.log(`✅ ${label || table}: ${data.length} rows`);
  return data;
}

// ─── Step 8: orchestrator ────────────────────────────────────────────────────
async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Mil&Base — Demo Seed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await clearTables();

  // 1) Users
  const users = await insertReturning('users', USERS, 'users');
  const magad = users.find(u => u.username === 'magad1');

  // 2) Soldiers — link some to users by personal_id↔username mapping
  // (We don't link 1-to-1 — soldiers are pure personnel records.)
  const soldiers = await insertReturning('soldiers', SOLDIERS, 'soldiers');

  // 3) Default personal equipment for every soldier
  const eqRows = soldiers.flatMap(s =>
    DEFAULT_EQ_TYPES.map(type => ({
      soldier_id: s.id,
      item_type:  type,
      // Randomize status: 70% issued, 20% missing, 10% returned
      status: chance(0.7) ? 'issued' : chance(0.66) ? 'missing' : 'returned',
    }))
  );
  await insertReturning('soldier_equipment', eqRows, 'soldier_equipment');

  // 4) Equipment items
  const items = await insertReturning('equipment_items', EQUIPMENT, 'equipment_items');

  // 5) Missions (created_by = magad)
  const missions = await insertReturning('missions',
    buildMissions().map(m => ({ ...m, created_by: magad?.id ?? null })),
    'missions'
  );

  // 6) Assignments — assign some soldiers (status='זמין' or 'במשימה') to active/planned missions
  const assignable = soldiers.filter(s => s.status === 'זמין' || s.status === 'במשימה');
  const activeMissions = missions.filter(m => m.status === 'פעיל' || m.status === 'מתוכנן');
  const assignmentRows = [];
  for (const m of activeMissions) {
    // Pick required_count random soldiers (or fewer if not enough available)
    const shuffled = [...assignable].sort(() => Math.random() - 0.5);
    const count = Math.min(m.required_count, shuffled.length, rand(1, m.required_count));
    for (let i = 0; i < count; i++) {
      assignmentRows.push({
        mission_id: m.id,
        soldier_id: shuffled[i].id,
        role_in_mission: 'לוחם',
        assigned_by: magad?.id ?? null,
        rest_warning: chance(0.15) ? 1 : 0,
      });
    }
  }
  // Dedupe (mission_id, soldier_id)
  const uniq = new Map();
  assignmentRows.forEach(a => uniq.set(`${a.mission_id}-${a.soldier_id}`, a));
  await insertReturning('assignments', [...uniq.values()], 'assignments');

  // 7) Equipment assignments (issuances) — pick random soldiers + items
  const issuances = [];
  for (let i = 0; i < 25; i++) {
    const s = pick(soldiers);
    const it = pick(items.filter(x => x.available_quantity > 0));
    const isReturned = chance(0.35);
    issuances.push({
      soldier_id: s.id,
      item_id:    it.id,
      quantity:   rand(1, 3),
      status:     isReturned ? 'הוחזר' : 'הונפק',
      issued_by:  magad?.id ?? null,
      returned_at: isReturned ? new Date().toISOString() : null,
    });
  }
  await insertReturning('equipment_assignments', issuances, 'equipment_assignments');

  // 8) Rations
  await insertReturning('rations_requests',
    buildRations().map(r => ({ ...r, created_by: magad?.id ?? null })),
    'rations_requests'
  );

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ✅  Seed completed successfully');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n  Login with any of these users (password: 1234):');
  USERS.forEach(u => console.log(`    • ${u.username.padEnd(10)} — ${u.full_name}  [${u.role}]`));
  console.log('');
}

main().catch(e => {
  console.error('\n❌ Seed failed:', e.message);
  process.exit(1);
});
