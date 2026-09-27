/**
 * REST client - the ONLY way the app talks to data.
 * React Native never connects to PostgreSQL directly.
 *
 * http://10.0.2.2:3000 = the ANDROID EMULATOR's alias for the host machine's
 * localhost - used for emulator verification.
 * For PHYSICAL devices on the same Wi-Fi, replace with the backend machine's
 * LAN IP (e.g. http://10.43.5.183:3000/api - check `ipconfig` if it changes).
 * USB-only alternative: run `adb reverse tcp:3000 tcp:3000`
 * and use http://localhost:3000/api instead.
 */
export const API_BASE = 'http://10.0.2.2:3000/api';

let currentUserId = null;
let currentUser = null;

export function setUser(id) {
  currentUserId = id;
}

export function getUser() {
  return currentUserId;
}

/** Store the logged-in user session (id, name, username, role). */
export function setSession(user) {
  currentUser = user || null;
  currentUserId = user ? user.id : null;
}

export function getSession() {
  return currentUser;
}

export function clearSession() {
  currentUser = null;
  currentUserId = null;
}

/** True when the signed-in user may open the given module (see modules.js). */
export function canAccess(moduleKey) {
  if (!currentUser) return false;
  if (moduleKey === 'dashboard') return true;
  return Array.isArray(currentUser.modules) && currentUser.modules.includes(moduleKey);
}

/** True while an admin still owes their forced first-login password reset. */
export function needsPasswordReset() {
  return !!(currentUser && currentUser.must_change_password);
}

export async function api(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(currentUserId ? {'X-User-Id': String(currentUserId)} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const get = p => api('GET', p);
export const post = (p, b) => api('POST', p, b);
export const put = (p, b) => api('PUT', p, b);
export const patch = (p, b) => api('PATCH', p, b);
export const del = p => api('DELETE', p);

/**
 * Direct-download URL for a bill PDF. The browser/device downloader cannot
 * send the X-User-Id header, so the user id travels as ?user_id= (accepted
 * by the backend for this route). Opening the URL downloads the PDF because
 * the endpoint responds with Content-Disposition: attachment.
 */
export function billPdfUrl(billId) {
  return `${API_BASE}/bills/${billId}/pdf?user_id=${encodeURIComponent(currentUserId || '')}`;
}

/** Direct-download URL for a lot document PDF (lot card / bill sheet). */
export function lotPdfUrl(lotId) {
  return `${API_BASE}/lots/${lotId}/pdf?user_id=${encodeURIComponent(currentUserId || '')}`;
}

/* ---------- Auth API ---------- */

export function login(username, password) {
  return post('/auth/login', {username, password});
}

export function changePassword(currentPassword, newPassword) {
  return post('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export function createAdminUser(details) {
  return post('/auth/users', details);
}

export function listAdminUsers() {
  return get('/auth/users');
}

/** Active roles from the Role master (assignable to new users). */
export function listRoles() {
  return get('/auth/roles');
}

/** Super Admin: update a user's active flag and/or module permissions. */
export function updateUser(id, changes) {
  return patch(`/auth/users/${id}`, changes);
}

export function requestResetOtp(contact) {
  return post('/auth/forgot-password/otp', {contact});
}

export function verifyResetOtp(contact, otp, newPassword) {
  return post('/auth/forgot-password/verify', {
    contact,
    otp,
    new_password: newPassword,
  });
}
