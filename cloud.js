import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (s) => document.querySelector(s);
const loginBtn = $('#cloud-login'), driveBtn = $('#drive-connect'), syncBtn = $('#cloud-sync'), logoutBtn = $('#cloud-logout');
const userEl = $('#cloud-user'), statusEl = $('#cloud-status');
let client = null, currentUser = null, driveConnected = false, syncTimer = null, syncing = false;
const configured = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_');

function status(message, kind = '') {
  if (!statusEl) return;
  const dot = kind === 'ok' ? 'ok' : kind === 'wait' ? 'wait' : kind === 'err' ? 'err' : '';
  statusEl.innerHTML = `<span class="cloud-dot ${dot}"></span>${escapeHtml(message)}`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setUi(user) {
  currentUser = user || null;
  loginBtn.hidden = !!user;
  logoutBtn.hidden = !user;
  driveBtn.disabled = !user;
  syncBtn.disabled = !user || !driveConnected;
  userEl.textContent = user ? `${user.user_metadata?.full_name || user.email} (${user.email})` : 'وارد نشده‌اید';
}
async function edge(action, body = {}) {
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('ابتدا وارد حساب شوید.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/drive-sync?action=${encodeURIComponent(action)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `خطای سرور (${res.status})`);
  return data;
}
async function refreshDriveStatus() {
  if (!currentUser) { driveConnected = false; setUi(null); return; }
  try { const d = await edge('status'); driveConnected = !!d.connected; }
  catch { driveConnected = false; }
  setUi(currentUser);
  status(driveConnected ? 'Google Drive متصل است.' : 'برای همگام‌سازی، Google Drive را متصل کنید.', driveConnected ? 'ok' : '');
}
async function doSync() {
  if (!currentUser || !driveConnected || syncing || !navigator.onLine) return;
  syncing = true; syncBtn.disabled = true; status('در حال همگام‌سازی نوشته‌ها و پوشه‌ها…', 'wait');
  try {
    const snapshot = window.NawisaApp?.getSnapshot();
    if (!snapshot) throw new Error('داده‌های برنامه در دسترس نیستند.');
    const result = await edge('sync', { snapshot });
    if (result.snapshot) {
      const pick = x => JSON.stringify({docs:x.docs||[],folders:x.folders||[],st:x.st||{},tombstones:x.tombstones||{docs:{},folders:{}}});
      if (pick(snapshot) !== pick(result.snapshot)) window.NawisaApp.applySnapshot(result.snapshot);
    }
    localStorage.setItem('writer_last_cloud_sync', String(Date.now()));
    status('همگام‌سازی کامل شد؛ نوشته‌ها و پوشه‌ها به‌روز هستند.', 'ok');
  } catch (e) { console.error(e); status(`همگام‌سازی انجام نشد: ${e.message}`, 'err'); }
  finally { syncing = false; syncBtn.disabled = !driveConnected; }
}
function queueSync() {
  if (!currentUser || !driveConnected) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => doSync(), 1800);
}
window.NawisaCloud = { queueSync, sync: doSync };

if (!configured) {
  status('برای فعال‌سازی، ابتدا آدرس و کلید Supabase را در فایل config.js وارد کنید.');
  loginBtn.disabled = true; driveBtn.disabled = true; syncBtn.disabled = true;
} else {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  loginBtn.addEventListener('click', async () => {
    try {
      status('در حال انتقال به Google…', 'wait');
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, scopes: 'openid email profile' } });
      if (error) throw error;
    } catch (e) { status(`ورود ناموفق بود: ${e.message}`, 'err'); }
  });
  logoutBtn.addEventListener('click', async () => {
    if (!confirm('از حساب کاربری خارج شوید؟ نوشته‌های محلی این دستگاه حذف نمی‌شوند.')) return;
    await client.auth.signOut(); driveConnected = false; setUi(null); status('از حساب خارج شدید. داده‌های محلی حفظ شده‌اند.');
  });
  driveBtn.addEventListener('click', async () => {
    try {
      status('در حال آماده‌سازی اتصال Google Drive…', 'wait');
      const d = await edge('connect-url', { returnTo: location.origin + location.pathname });
      location.href = d.url;
    } catch (e) { status(`اتصال Drive ناموفق بود: ${e.message}`, 'err'); }
  });
  syncBtn.addEventListener('click', doSync);
  client.auth.onAuthStateChange(async (_event, session) => {
    setUi(session?.user || null);
    if (session?.user) await refreshDriveStatus();
    else { driveConnected = false; status('برای همگام‌سازی وارد حساب گوگل شوید.'); }
  });
  const params = new URLSearchParams(location.search);
  if (params.has('drive')) {
    history.replaceState({}, '', location.pathname + location.hash);
    if (params.get('drive') === 'connected') status('Google Drive با موفقیت متصل شد.', 'ok');
    else if (params.get('drive') === 'error') status('اتصال Google Drive کامل نشد. دوباره تلاش کنید.', 'err');
  }
  client.auth.getSession().then(async ({ data: { session } }) => {
    setUi(session?.user || null);
    if (session?.user) {
      await refreshDriveStatus();
      if (driveConnected) await doSync();
    }
  });
  window.addEventListener('online', () => { if (driveConnected) doSync(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && driveConnected) doSync(); });
  window.addEventListener('beforeunload', () => { if (currentUser && driveConnected) clearTimeout(syncTimer); });
}
