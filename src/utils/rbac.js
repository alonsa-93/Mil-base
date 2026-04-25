export const ROLE_LEVELS = { lohem: 1, samal: 2, rasap: 3, mefaked: 4, magad: 5 };

export const ROLE_LABELS = {
  lohem: 'לוחם', samal: 'סמל', rasap: 'רס"פ', mefaked: 'מפקד', magad: 'מג"ד',
};

export function hasRole(userRole, minRole) {
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 99);
}

export function canEdit(userRole) { return hasRole(userRole, 'samal'); }
export function canManageLogistics(userRole) { return hasRole(userRole, 'rasap'); }
export function canAdmin(userRole) { return hasRole(userRole, 'mefaked'); }
export function isMagad(userRole) { return hasRole(userRole, 'magad'); }
