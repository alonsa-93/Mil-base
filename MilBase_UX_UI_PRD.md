# PRD — שדרוג UX/UI מערכת Mil&Base
**Product Requirements Document | גרסה 1.0**
**תאריך:** אפריל 2026 | **מוצר:** Mil&Base — מערכת ניהול צבאית

---

## 1. מטרת המסמך

מסמך זה מגדיר את דרישות השדרוג לחווית המשתמש (UX) ועיצוב הממשק (UI) של מערכת Mil&Base.
הוא מיועד לעבור לצוות עיצוב/פיתוח frontend לביצוע.

---

## 2. סקירת המערכת הקיימת

### 2.1 Stack טכני
- **Frontend:** React 18 + Vite + Tailwind CSS
- **עיצוב נוכחי:** RTL, פונט Rubik, סכמת צבעים navy + blue
- **מסכים:** Login, Dashboard, סד"כ, לוח משימות, לוגיסטיקה, הזנה ומים, דוחות, לוג פעולות, ניהול משתמשים, המשימות שלי
- **תפקידים:** מג"ד / מפקד / רס"פ / סמל / לוחם (5 רמות הרשאה)

### 2.2 ממצאי UX מהקוד הקיים

| מסך | בעיות שזוהו |
|-----|-------------|
| **Login** | אין אינדיקציה ויזואלית לחוזק סיסמה; כפתור ה-demo חשוף גם ב-production |
| **Dashboard** | StatCards פשוטים ללא trend / delta; Pie chart בלי Legend מוסבר; אין quick-actions |
| **סד"כ (Soldiers)** | טבלה צפופה — 9 עמודות ב-mobile חוסמות קריאה; חיפוש ו-4 פילטרים על שורה אחת לא נוח; מודל עריכה נפתח כ-overlay ללא breadcrumb; `confirm()` ו-`alert()` native browsers לאישורי מחיקה |
| **לוח משימות (Calendar)** | אין drag-and-drop לשינוי מיקום משימות; view שבועי מוגבל ל-700px min-width — overflow ב-mobile; אין color legend לדחיפות/סטטוס; שיבוץ לוחמים מוסתר בתוך modal בתוך modal (3 רמות עמוק) |
| **לוגיסטיקה** | emoji dots (🔴🟢⚪) כאינדיקטורי סטטוס — לא accessible; לשינוי סטטוס צריך ללחוץ בלי feedback ברור ("cycle click") |
| **הזנה ומים** | הצגה פשטנית, אין visualization לפי ארוחה/יום |
| **דוחות** | אין preview לפני export; כפתורי PDF/Excel בלי הסבר מה ייצא |
| **לוג פעולות** | גריד טקסטואלי צפוף; JSON גולמי ב-old_value/new_value |
| **כללי** | Toast notifications חסרים לחלוטין — `alert()` / `confirm()` browser native; אין skeleton loading; אין empty states מעוצבים; Sidebar אין badge ל-unread alerts; Header ריק פונקציונלית |

---

## 3. עקרונות העיצוב המבוקשים

### 3.1 Design Principles
1. **Military Clarity** — מידע קריטי גלוי מיד, ללא חפירה בתפריטים
2. **RTL First** — כל קומפוננטה נבנית מהתחלה כ-RTL, לא adapted
3. **Accessible Alerts** — אסור emoji/color-only — תמיד טקסט + צבע ביחד
4. **Progressive Disclosure** — הצג רק מה שצריך; פרטים ב-expand/modal
5. **Offline-Ready Feel** — Optimistic UI + loading states בכל action

### 3.2 Design System Tokens (מוצע)
```
Primary:  #1e3a5f (Navy) / #3b82f6 (Blue-500) / #1d4ed8 (Blue-700)
Success:  #10b981 (Emerald-500)
Warning:  #f59e0b (Amber-500)
Danger:   #ef4444 (Red-500)
Neutral:  #f8fafc → #0f172a (Slate scale)

Radius:   4px (tight) / 8px (card inner) / 12px (card) / 16px (modal) / 9999px (badge)
Font:     Rubik (קיים) — weights: 400/500/600/700/800
Spacing:  4-based scale (4/8/12/16/20/24/32/40/48/64)
Shadow:   3 levels — sm / md / lg
```

---

## 4. דרישות לפי מסך

---

### 4.1 מסך Login

**מצב נוכחי:** טופס בסיסי על רקע navy עם decorative circles

**שדרושים:**

#### P0 — קריטי
- [ ] **הסר demo buttons** מ-production build (הצג רק כאשר `VITE_SHOW_DEMO=true`)
- [ ] **Accessible error state** — focus ring אדום על input שגוי + error message מקושר ב-`aria-describedby`

#### P1 — חשוב
- [ ] **Password visibility toggle** — כפתור 👁 לחשיפת/הסתרת סיסמה
- [ ] **Loading skeleton** על הכפתור — spinner + "מתחבר..." (קיים, טוב)
- [ ] **OTP UX upgrade** — במקום input אחד, 6 תיבות נפרדות (auto-advance), paste support

#### P2 — שיפור
- [ ] אנימציית fade-in חלקה יותר על הכרטיס (כבר קיים `animate-slide-up`, לשפר ל-spring physics)
- [ ] "שכחתי סיסמה" placeholder (אפילו אם לא פונקציונלי עדיין — מוריד חרדה)

**Wireframe concept:**
```
┌─────────────────────────────┐
│  🛡  Mil&Base               │
│     מערכת ניהול אופרטיבי   │
├─────────────────────────────┤
│  [שם משתמש ___________]    │
│  [סיסמה _____________ 👁]  │
│  [  כניסה למערכת  ▶  ]     │
│─────────────────────────────│
│  ❌ שגיאה: פרטים שגויים    │  ← styled, not browser alert
└─────────────────────────────┘
```

---

### 4.2 AppShell — Sidebar + Header

**מצב נוכחי:** Sidebar navy קיים, Header כמעט ריק

**שדרושים:**

#### P0
- [ ] **Notification badge** בסיידבר — badge אדום על "דשבורד" / "לוח משימות" כאשר יש חירום פעיל
- [ ] **Active breadcrumb** בהדר — "לוח משימות > שמירת הצפון" במקום ריק

#### P1
- [ ] **User role badge** ב-Sidebar footer — "מפקד" / "רס"פ" וכו' כ-chip מתחת לשם
- [ ] **Collapse sidebar** — כפתור לכיווץ ל-icon-only mode (desktop) לחיסכון במקום
- [ ] **Quick action button** בהדר — "+" dropdown לפתיחת משימה / לוחם חדש מכל מקום
- [ ] **Online/Offline indicator** — נקודה ירוקה/אפורה בהדר

#### P2
- [ ] **Keyboard shortcut hints** ב-tooltips של nav items (Ctrl+1 לדשבורד וכו')
- [ ] **Active page title** בהדר (כבר יש תאריך — להוסיף שם עמוד)

---

### 4.3 Dashboard

**מצב נוכחי:** 4 StatCards + PieChart + BarChart + רשימת משימות קרובות

**שדרושים:**

#### P0
- [ ] **Emergency banner** — כאשר יש משימת חירום, banner צמוד לראש הדף בצבע אדום עם pulsing animation
- [ ] **Skeleton loading** — למנוע layout shift בטעינה (כרגע spinner בלבד)

#### P1
- [ ] **StatCards עם delta** — "↑ 3 מהשבוע שעבר" / "↓ 1" כתת-כותרת קטנה
- [ ] **Clickable charts** — לחיצה על slice בPie → מסנן את טבלת הסד"כ לאותו סטטוס
- [ ] **Chart legend** — מקרא ברור מתחת לגרפים עם צבע + תווית
- [ ] **"זמינות עכשיו" widget** — מספר לוחמים זמינים + פס התקדמות (כמה מהכוח הכולל)
- [ ] **Quick links** — 3 כפתורים: "+ משימה", "+ לוחם", "ייצוא PDF" מהדשבורד

#### P2
- [ ] **Last updated timestamp** — "עודכן לאחרונה: 14:32"
- [ ] **Mini sparkline** על כל StatCard — trend 7 ימים
- [ ] **Responsive reflow** — ב-mobile, charts מופיעים כ-stacked עמודה

---

### 4.4 מסך סד"כ (Soldiers)

**מצב נוכחי:** טבלה עם 9 עמודות, 4 פילטרים, bulk actions, modals לעריכה/צפייה

**שדרושים:**

#### P0
- [ ] **Replace `confirm()` / `alert()`** עם Dialog/Toast מעוצב בכל פעולת מחיקה/שגיאה
- [ ] **Mobile card view** — מתחת ל-768px, הטבלה מתחלף ל-card list עם swipe-actions (edit/delete)

#### P1
- [ ] **Filter chips** — במקום 4 dropdowns על שורה, הצג כ-pill chips הניתנים להסרה בלחיצה
- [ ] **Soldier avatar** — אות ראשונה של השם בעיגול צבעוני (נוסף לשם) — visual anchor
- [ ] **Inline status change** — לחיצה על badge הסטטוס בטבלה → popover עם 5 אפשרויות (במקום לפתוח modal)
- [ ] **View/Edit modal — tabs** — "פרטים אישיים | שיבוץ | מידות | תזונה" במקום scroll ארוך
- [ ] **Import progress bar** — כרגע אין feedback בייבוא קובץ גדול

#### P2
- [ ] **Column visibility toggle** — תפריט לבחירת עמודות להצגה
- [ ] **Sort on column headers** — לחיצה על כותרת → מיון עולה/יורד
- [ ] **Soldier profile page** (נפרד ממודל) — `/soldiers/:id` עם היסטוריית משימות, ציוד, תת-פרטים

---

### 4.5 לוח משימות (Calendar)

**מצב נוכחי:** view שבועי/חודשי, drag לא קיים, modal יצירה/פרטי משימה

**שדרושים:**

#### P0
- [ ] **Color legend** — פס צבע קבוע מעל הלוח: 🔵 רגיל | 🟠 דחוף | 🔴 חירום | ✅ הסתיים | ⚫ בוטל
- [ ] **Overflow mobile** — להחליף `min-w-[700px]` ב-scroll חלק + swipe בין ימות השבוע

#### P1
- [ ] **Day view** — הוסף view שלישי "יומי" עם timeline שעתית (00:00–24:00)
- [ ] **Drag & Drop** — Drag mission chips בין ימים (עדכון `start_time`/`end_time` אוטומטי)
- [ ] **Mission modal — split layout** — כאשר modal פתוח בdesktop: שמאל פרטי משימה, ימין לוחמים משובצים (במקום scroll אנכי)
- [ ] **Conflict indicator** — כאשר לוחם כבר במשימה חופפת, הצג warning icon על השם (כרגע מוסתר)
- [ ] **Rest warning prominent** — badge 🟡 "⚠ פחות מ-8 שעות מנוחה" מודגש יותר בהצעות שיבוץ

#### P2
- [ ] **"+ משימה" על hover** ב-month view — להציג בכל תא, לא רק כאשר תא ריק
- [ ] **Recurring missions** — checkbox "משימה חוזרת" + בחירת תדירות
- [ ] **Export calendar** — ייצוא לקובץ `.ics` (Google Calendar / Outlook)

---

### 4.6 לוגיסטיקה (Logistics)

**מצב נוכחי:** tabs: מלאי / שיבוץ / פערים / ניפוק אישי, status cycle בלחיצה

**שדרושים:**

#### P0
- [ ] **Replace emoji status dots** (🔴🟢⚪) — השתמש בצורות גיאומטריות + צבע + טקסט (לא רק emoji)
- [ ] **Confirmation on status cycle** — לחיצה על סטטוס → popover "לשנות ל-X?" + אישור (כרגע שינוי מיידי ללא אישור)

#### P1
- [ ] **Inventory progress bars** — עבור כל פריט, הצג `available/total` כ-progress bar צבעונית
- [ ] **Gaps panel upgrade** — כרגע רשימה פשוטה; הצג כ-alert cards עם "הזמן עכשיו" CTA
- [ ] **Category filter tabs** — טאבים אופקיים לקטגוריות (ציוד מגן | נשק | תקשורת...) במקום dropdown
- [ ] **Soldier equipment grid** — עבור ניפוק אישי, הצג grid של soldier × item_type (כמו spreadsheet) לסקירה מהירה

#### P2
- [ ] **Scan barcode placeholder** — כפתור מצלמה (לעתיד) לסריקת QR/ברקוד
- [ ] **Audit trail per item** — כרגע ניתן רק דרך לוג כללי; הוסף "היסטוריה" per-item

---

### 4.7 הזנה ומים (Rations)

**מצב נוכחי:** טבלת בקשות + "חשב צורך" + יצירה/מחיקה

**שדרושים:**

#### P0
- [ ] **Demand summary cards** — לפני הטבלה, הצג 4 cards: סה"כ / טבעוני / צמחוני / אלרגיות
- [ ] **Meal type icons** — 🌅 בוקר | ☀️ צהריים | 🌙 ערב (+ label — לא רק emoji)

#### P1
- [ ] **Weekly planner view** — grid שבועי (ימים × ארוחות) לתכנון קל
- [ ] **Dietary breakdown chart** — bar chart: כמה מכל סוג תזונה מהיחידה
- [ ] **Duplicate detection** — אזהרה כאשר כבר נוצרה בקשה לאותה ארוחה/תאריך

#### P2
- [ ] **Notes per request** — שדה הערות בטופס הבקשה
- [ ] **History timeline** — הצגת בקשות עבר כ-timeline ויזואלי

---

### 4.8 דוחות (Reports)

**מצב נוכחי:** כפתורי Export ל-PDF/Excel לפי סוג

**שדרושים:**

#### P0
- [ ] **Preview panel** — לפני ייצוא, הצג preview טבלאי של הנתונים שייצאו
- [ ] **Export scope selector** — "כל הנתונים / טווח תאריכים / פילטר נוכחי"

#### P1
- [ ] **Report templates** — 3 תבניות מוכנות: "דוח שבועי", "מצאי לוגיסטי", "כוח אדם"
- [ ] **Scheduled reports placeholder** — UI לתזמון שליחת דוח שבועי (email)
- [ ] **Chart export** — אפשרות לייצא גרפים כ-PNG

#### P2
- [ ] **Branded PDF header** — לוגו Mil&Base + שם יחידה + תאריך בכל עמוד
- [ ] **Print view** — `/reports/print` עם CSS print-optimized (כבר יש `@media print` בסיסי)

---

### 4.9 לוג פעולות (Audit Log)

**מצב נוכחי:** טבלה עם פילטרים; JSON גולמי בעמודות old/new value

**שדרושים:**

#### P0
- [ ] **JSON pretty-printer** — הצג old_value/new_value כ-diff (ירוק הוסף, אדום נמחק)
- [ ] **Action type icons** — icon לכל action type (CREATE=+, UPDATE=✏, DELETE=🗑)

#### P1
- [ ] **Timeline view** — רשימה כרונולוגית עם grouping לפי תאריך
- [ ] **Advanced filters** — פילטר לפי user_id, entity_type, תאריך range (חלקית קיים)
- [ ] **Export audit log** — ייצוא ל-CSV לצורכי compliance

#### P2
- [ ] **Activity graph** — heatmap (כמו GitHub) של פעילות לפי יום/שעה

---

### 4.10 ניהול משתמשים (Admin Panel)

**מצב נוכחי:** טבלה פשוטה + modal יצירה/עריכה

**שדרושים:**

#### P1
- [ ] **Role badge** — badge צבעוני לפי תפקיד בטבלה (לא רק טקסט)
- [ ] **Last active** — עמודת "התחבר לאחרונה" (מהלוג)
- [ ] **Password reset flow** — כפתור "איפוס סיסמה" שמייצר temp password במקום לשלוח את הסיסמה בקלר

#### P2
- [ ] **User activity summary** — כמה פעולות ביצע המשתמש ב-30 יום
- [ ] **Suspend user** — toggle להשהיית גישה ללא מחיקה

---

### 4.11 MyMissions (לוחם)

**מצב נוכחי:** רשימה פשוטה של המשימות של הלוחם המחובר

**שדרושים:**

#### P0
- [ ] **Next mission hero card** — ה"כרטיס" הגדול הבא שמציג: שם משימה, זמן עד לתחילה (countdown), מיקום, ציוד נדרש

#### P1
- [ ] **Mission timeline** — ציר זמן ויזואלי של משימות עבר/עתיד
- [ ] **Rest indicator** — "שעות מנוחה מאז משימה אחרונה: 12h" עם progress bar ל-8 שעות
- [ ] **Notification preference** — "הודע לי שעה לפני" (placeholder לעתיד)

---

## 5. קומפוננטות גלובליות חסרות

### 5.1 Toast Notification System
**עדיפות: P0 — קריטי**

כרגע המערכת משתמשת ב-`alert()` / `confirm()` של הדפדפן.
יש להחליף ב-Toast system מרכזי:

```
עיצוב:
┌────────────────────────────────┐
│  ✅  הלוחם נוסף בהצלחה        │  ← success (ירוק)
└────────────────────────────────┘
┌────────────────────────────────┐
│  ❌  שגיאה: מספר אישי כפול   │  ← error (אדום)
└────────────────────────────────┘
┌────────────────────────────────┐
│  ⚠️  אזהרת מנוחה: 6 שעות בלבד│  ← warning (כתום)
└────────────────────────────────┘
```

**מיקום:** top-center ב-RTL  
**duration:** 4 שניות + סגירה ידנית  
**stack:** עד 3 toasts במקביל  

### 5.2 Confirm Dialog Component
**עדיפות: P0**

להחליף `confirm()` native ב-modal מעוצב עם:
- כותרת + תיאור
- "אישור" (אדום למחיקה) + "ביטול"
- אנימציית כניסה

### 5.3 Skeleton Loaders
**עדיפות: P1**

לכל טבלה/כרטיס — skeleton screen ב-loading state במקום spinner בודד:
```
┌──────────────────────────────────┐
│  ████████████  ░░░░  ░░░░░░░░   │  ← shimmer animation
│  ███████  ░░░░░░░░░░  ░░░░░░   │
│  ████████████████  ░░░░░░░░░   │
└──────────────────────────────────┘
```

### 5.4 Empty States
**עדיפות: P1**

כרגע: "אין נתונים להצגה" — טקסט גרידא.  
יש להחליף ב-empty state מעוצב:
- Illustration (SVG פשוט)
- כותרת + sub-text
- CTA button כאשר רלוונטי ("+ הוסף לוחם ראשון")

### 5.5 Global Search
**עדיפות: P2**

Command palette (Cmd+K) לחיפוש מהיר על פני כל הנתונים:
- חיפוש לוחמים לפי שם/מספר אישי
- חיפוש משימות
- ניווט מהיר לדפים

---

## 6. נגישות (Accessibility)

### דרישות A11y חובה (WCAG 2.1 AA)

| פריט | מצב נוכחי | מבוקש |
|------|-----------|-------|
| Color contrast | ✅ Navy+White עובר | ✅ לשמור |
| Focus indicators | ⚠️ חלקי | כל element interactable — focus ring ברור |
| ARIA labels | ❌ חסר בטבלאות ו-buttons icon-only | `aria-label` על כל icon button |
| Keyboard navigation | ⚠️ חלקי | Tab/Enter/Escape בכל modal וtable |
| Screen reader support | ❌ לא נבדק | `role`, `aria-live` על alerts |
| Color-only status | ❌ emoji dots בלוגיסטיקה | תמיד טקסט + צבע |

---

## 7. Mobile Responsiveness

### Breakpoints מבוקשים

| Breakpoint | שימוש |
|------------|-------|
| `< 640px` (sm) | Phone — card list, bottom nav |
| `640–1024px` (md) | Tablet — sidebar collapsed by default |
| `> 1024px` (lg) | Desktop — full sidebar + table view |

### שינויים ספציפיים ל-Mobile

1. **סד"כ** — טבלה → card list עם swipe
2. **לוח משימות** — week view → day view כברירת מחדל; swipe בין ימים
3. **Sidebar** — על mobile, bottom tab bar במקום hamburger menu
4. **Modals** — על mobile, slide-up sheet במקום centered modal

---

## 8. Performance UX

| פריט | דרישה |
|------|-------|
| First Contentful Paint | < 1.5s |
| Skeleton screens | בכל data-fetch > 200ms |
| Optimistic updates | לshיבוצ סטטוס בלוגיסטיקה (כבר קיים — לשמור) |
| Image lazy loading | אם יתווספו תמונות |
| Virtual scroll | בטבלת סד"כ כאשר > 200 רשומות |

---

## 9. Micro-interactions

פרטים קטנים שמשפרים את תחושת המערכת:

| Action | מיקרו-אינטראקציה מבוקשת |
|--------|--------------------------|
| שמירת לוחם | ✅ checkmark animation על הכפתור → toast |
| מחיקה | 🗑 shake animation על הכפתור + confirmation |
| שיבוץ לוחם | 👤 avatar "מוסיף" לרשימה עם slide-in |
| Status change | badge מתעדכן עם fade (כבר חלקי) |
| Loading | progress bar עדין בראש הדף (NProgress style) |
| Error state | input shake + border אדום |

---

## 10. עדיפויות ביצוע (Roadmap)

### Phase 1 — Foundations (שבוע 1–2)
**P0 — חובה לפני launch**
- [ ] Toast/Confirm system (מחליף alert/confirm)
- [ ] Skeleton loaders גלובליים
- [ ] Mobile card view לסד"כ
- [ ] Color legend ללוח משימות
- [ ] Replace emoji status indicators בלוגיסטיקה
- [ ] הסתרת demo buttons ב-production

### Phase 2 — Enhancement (שבוע 3–4)
**P1 — שיפורי UX משמעותיים**
- [ ] Dashboard — delta על StatCards + quick actions
- [ ] Filter chips בסד"כ
- [ ] Calendar — mobile swipe + Day view
- [ ] Logistics — inventory progress bars
- [ ] Admin — role badges + last active
- [ ] MyMissions — next mission hero card
- [ ] Notification badge בsidebar

### Phase 3 — Polish (שבוע 5–6)
**P2 — פרטי עיצוב**
- [ ] Global search (Cmd+K)
- [ ] Drag & drop בלוח משימות
- [ ] Audit log — diff view
- [ ] Empty states מעוצבים
- [ ] Animation & micro-interactions

---

## 11. Design Deliverables מבוקשים מהמעצב

- [ ] **Design Tokens file** (Figma / CSS variables) — צבעים, spacing, radius, shadows
- [ ] **Component library** — כל הקומפוננטות המשותפות (Button, Badge, Toast, Modal, Input)
- [ ] **High-fidelity screens** לכל 10 מסכים
- [ ] **Mobile mockups** לפחות ל: Login, Dashboard, סד"כ, Calendar
- [ ] **Interaction spec** לDrag&Drop ולToast system
- [ ] **Handoff** ב-Figma עם Auto Layout + Hebrew text samples

---

## 12. Out of Scope (לא בגרסה זו)

- שינוי logic עסקית / backend
- שינוי מבנה מסד נתונים
- הוספת מודולים חדשים
- Dark mode (יכול להוסף ב-Phase 4)
- PWA / native app

---

## 13. הגדרת הצלחה

| מדד | יעד |
|-----|-----|
| אחוז פעולות ללא browser `alert()` | 100% |
| זמן ממוצע לשיבוץ לוחם למשימה | < 30 שניות |
| ציון Lighthouse Accessibility | > 90 |
| שגיאות UI ב-mobile (< 768px) | 0 |
| משתמשים שדיווחו על "לא הבינו" | < 5% בבדיקת משתמשים |

---

*מסמך זה מיועד להעברה לצוות עיצוב/פיתוח Frontend.*
*גרסה 1.0 — Mil&Base UX/UI PRD — אפריל 2026*
