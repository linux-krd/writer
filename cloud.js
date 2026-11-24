import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (s) => document.querySelector(s);
const loginBtn = $('#cloud-login'), driveBtn = $('#drive-connect'), syncBtn = $('#cloud-sync'), logoutBtn = $('#cloud-logout');
const userEl = $('#cloud-user'), statusEl = $('#cloud-status');
let client = null, currentUser = null, driveConnected = false, syncTimer = null, syncing = false, dirty = false, lastSyncEnd = 0, statusPromise = null, autoTimer = null;
const AUTO_MIN_INTERVAL = 60000; // خودکار (بازگشت به صفحه/آنلاین شدن) حداکثر هر ۶۰ ثانیه
const configured = SUPABASE_URL.startsWith('https://') && SUPABASE_URL.includes('.supabase.co') && SUPABASE_ANON_KEY.startsWith('sb_publishable_');

function status(message, kind = '') {
  if (!statusEl) return;
  const dot = kind === 'ok' ? 'ok' : kind === 'wait' ? 'wait' : kind === 'err' ? 'err' : '';
  const dd = $('#ddot'); if (dd) dd.className = 'dd ' + dot;
  statusEl.innerHTML = `<span class="cloud-dot ${dot}"></span>${escapeHtml(message)}`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function setUi(user) {
  currentUser = user || null;
  loginBtn.hidden = !!user;
  logoutBtn.hidden = !user;
  driveBtn.disabled = !user;
  syncBtn.disabled = !user || !driveConnected || syncing;
  userEl.textContent = user ? `${user.user_metadata?.full_name || user.email} (${user.email})` : 'وارد نشده‌اید';
}
async function edge(action, body = {}) {
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('ابتدا وارد حساب شوید.');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/dynamic-api?action=${encodeURIComponent(action)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `خطای سرور (${res.status})`);
  return data;
}
function friendlyError(e) {
  const m = String(e?.message || e || '');
  if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'اتصال اینترنت برقرار نیست یا سرور در دسترس نیست. دوباره تلاش کنید.';
  if (/Unauthorized|401|ابتدا وارد/i.test(m)) return 'نشست ورود منقضی شده است. دوباره وارد حساب گوگل شوید.';
  if (/not connected/i.test(m)) return 'Google Drive متصل نیست. ابتدا آن را متصل کنید.';
  if (/Google Drive API (401|403)|refresh Google token|invalid_grant/i.test(m)) return 'دسترسی به Google Drive معتبر نیست. Google Drive را دوباره متصل کنید.';
  if (/Google Drive API 429/i.test(m)) return 'تعداد درخواست‌ها به Google Drive زیاد بود. کمی بعد دوباره تلاش کنید.';
  return m || 'خطای ناشناخته';
}
function refreshDriveStatus() {
  if (statusPromise) return statusPromise; // جلوگیری از درخواست‌های هم‌زمان status
  statusPromise = (async () => {
    if (!currentUser) { driveConnected = false; setUi(null); return; }
    try { const d = await edge('status'); driveConnected = !!d.connected; }
    catch { driveConnected = false; }
    setUi(currentUser);
    if (!syncing) status(driveConnected ? 'Google Drive متصل است.' : 'برای هماهنگ‌سازی، Google Drive را متصل کنید.', driveConnected ? 'ok' : '');
  })().finally(() => { statusPromise = null; });
  return statusPromise;
}
// نسخهٔ قابل‌مقایسه (مستقل از ترتیب) از داده‌های برنامه
function canon(x) {
  const byId = (a) => [...(a || [])].sort((p, q) => String(p.id).localeCompare(String(q.id)));
  const stable = (v) => JSON.stringify(v, (k, val) => (val && typeof val === 'object' && !Array.isArray(val)) ? Object.keys(val).sort().reduce((o, key) => (o[key] = val[key], o), {}) : val);
  return stable({ docs: byId(x.docs), folders: byId(x.folders), st: x.st || {}, tombstones: x.tombstones || { docs: {}, folders: {} } });
}
// manual=true: کلیک کاربر. در غیر این صورت: خودکار و تابع محدودیت زمانی
async function doSync(manual = false) {
  if (syncing) { dirty = dirty || !manual; return; }          // هم‌زمان فقط یک عملیات
  if (!currentUser || !driveConnected) return;
  if (!navigator.onLine) { if (manual) status('اتصال اینترنت برقرار نیست.', 'err'); return; }
  if (!manual && !dirty && Date.now() - lastSyncEnd < AUTO_MIN_INTERVAL) return;
  syncing = true; dirty = false; clearTimeout(syncTimer); syncBtn.disabled = true;   // قبل از هر await
  status('در حال هماهنگ‌سازی...', 'wait');
  try {
    const live = window.NawisaApp?.getSnapshot();
    if (!live) throw new Error('داده‌های برنامه در دسترس نیستند.');
    const sent = JSON.parse(JSON.stringify(live));            // کپی ثابت از آنچه ارسال می‌شود
    const sentCanon = canon(sent);
    const result = await edge('sync', { snapshot: sent });
    let applied = false;
    if (result.snapshot) {
      const nowCanon = canon(window.NawisaApp.getSnapshot());
      if (nowCanon !== sentCanon) {
        dirty = true;                                         // کاربر حین هماهنگ‌سازی ویرایش کرده؛ روی داده‌اش بازنویسی نمی‌کنیم
      } else if (canon(result.snapshot) !== sentCanon) {
        window.NawisaApp.applySnapshot(result.snapshot);      // بدون بارگذاری مجدد صفحه
        applied = true;
      }
    }
    lastSyncEnd = Date.now();
    localStorage.setItem('writer_last_cloud_sync', String(lastSyncEnd));
    status('هماهنگ‌سازی با موفقیت انجام شد', 'ok');
  } catch (e) { console.error(e); status(`هماهنگ‌سازی انجام نشد: ${friendlyError(e)}`, 'err'); }
  finally {
    syncing = false; setUi(currentUser);
    if (dirty) queueSync();                                   // تغییرات حین عملیات، یک بار بعداً ارسال می‌شود
  }
}
function autoSync() {            // رویدادهای صفحه/شبکه: ادغام و تأخیر کوتاه
  if (!currentUser || !driveConnected) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => doSync(false), 1500);
}
function queueSync() {
  if (!currentUser || !driveConnected) return;
  dirty = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => doSync(false), 1800);
}
window.NawisaCloud = { queueSync, sync: () => doSync(true) };

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
  syncBtn.addEventListener('click', (ev) => { ev.preventDefault(); doSync(true); });
  let lastUserId = null;
  client.auth.onAuthStateChange((event, session) => {
    // داخل callback چیزی await نمی‌کنیم (مشکل شناخته‌شدهٔ قفل در supabase-js)
    setTimeout(async () => {
      const user = session?.user || null;
      if (user && user.id === lastUserId && driveConnected) { currentUser = user; return; }  // SIGNED_IN/TOKEN_REFRESHED تکراری
      lastUserId = user?.id || null;
      setUi(user);
      if (user) await refreshDriveStatus();
      else { driveConnected = false; status('برای هماهنگ‌سازی وارد حساب گوگل شوید.'); }
    }, 0);
  });
  const params = new URLSearchParams(location.search);
  if (params.has('drive')) {
    history.replaceState({}, '', location.pathname + location.hash);
    if (params.get('drive') === 'connected') status('Google Drive با موفقیت متصل شد.', 'ok');
    else if (params.get('drive') === 'error') status('اتصال Google Drive کامل نشد. دوباره تلاش کنید.', 'err');
  }
  client.auth.getSession().then(async ({ data: { session } }) => {
    if (!session?.user) return;
    currentUser = session.user;
    await refreshDriveStatus();
    if (driveConnected) await doSync(false);
  });
  window.addEventListener('online', autoSync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) autoSync(); });
}
