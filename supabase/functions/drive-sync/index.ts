import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceKey);
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const REDIRECT_URI = `${supabaseUrl}/functions/v1/drive-sync?action=callback`;

function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function unb64(s: string) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }
async function cryptoKey() {
  const raw = unb64(Deno.env.get('TOKEN_ENCRYPTION_KEY') || '');
  if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cryptoKey(), new TextEncoder().encode(value));
  return `${b64(iv)}.${b64(new Uint8Array(cipher))}`;
}
async function decrypt(value: string) {
  const [iv, data] = value.split('.');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await cryptoKey(), unb64(data));
  return new TextDecoder().decode(plain);
}
async function googleToken(code: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error_description || d.error || 'Google token exchange failed'); return d;
}
async function getAccessToken(userId: string) {
  const { data, error } = await admin.from('drive_tokens').select('encrypted_refresh_token').eq('user_id', userId).maybeSingle();
  if (error || !data?.encrypted_refresh_token) throw new Error('Google Drive is not connected');
  const refresh = await decrypt(data.encrypted_refresh_token);
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, refresh_token: refresh, grant_type: 'refresh_token' }) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error_description || d.error || 'Could not refresh Google token'); return d.access_token as string;
}
async function drive(access: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${access}`, ...(init.headers || {}) } });
  if (!r.ok) { const t = await r.text(); throw new Error(`Google Drive API ${r.status}: ${t.slice(0, 500)}`); }
  if (r.status === 204) return null;
  const type = r.headers.get('content-type') || '';
  return type.includes('application/json') ? r.json() : r.text();
}
async function getOrCreateFolder(access: string) {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.folder' and name='نویسه' and trashed=false");
  const found: any = await drive(access, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10`);
  if (found.files?.length) return found.files[0].id as string;
  const made: any = await drive(access, 'https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'نویسه', mimeType: 'application/vnd.google-apps.folder' }) });
  return made.id as string;
}
async function driveText(access: string, url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${access}` } });
  if (!r.ok) throw new Error(`Google Drive API ${r.status}: ${(await r.text()).slice(0, 500)}`);
  return await r.text();
}
async function readBackup(access: string, folderId: string) {
  const q = encodeURIComponent(`'${folderId}' in parents and name='nawisa-backup.json' and trashed=false`);
  const found: any = await drive(access, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&pageSize=10`);
  if (!found.files?.length) return { fileId: null, snapshot: null };
  const file = found.files[0];
  const raw = await driveText(access, `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
  try { return { fileId: file.id, snapshot: JSON.parse(raw) }; } catch { throw new Error('Backup file in Google Drive is not valid JSON'); }
}
function mergeById(local: any[] = [], remote: any[] = [], localT: Record<string, number> = {}, remoteT: Record<string, number> = {}) {
  const all = new Map<string, any>();
  for (const item of [...remote, ...local]) {
    const id = String(item.id); const prev = all.get(id);
    if (!prev || Number(item.u || 0) >= Number(prev.u || 0)) all.set(id, item);
  }
  const tomb = { ...remoteT, ...localT };
  for (const [id, deletedAt] of Object.entries(tomb)) {
    const item = all.get(id);
    if (!item || Number(deletedAt) >= Number(item.u || 0)) all.delete(id);
  }
  return [...all.values()];
}
function mergeSnapshots(local: any, remote: any) {
  if (!remote) return local;
  const lt = local.tombstones || { docs: {}, folders: {} }, rt = remote.tombstones || { docs: {}, folders: {} };
  const mergeTombs = (a: Record<string, number> = {}, b: Record<string, number> = {}) => Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b)])].map(id => [id, Math.max(Number(a[id] || 0), Number(b[id] || 0))]));
  const tombstones = { docs: mergeTombs(rt.docs, lt.docs), folders: mergeTombs(rt.folders, lt.folders) };
  const docs = mergeById(local.docs, remote.docs, tombstones.docs, rt.docs);
  const folders = mergeById(local.folders, remote.folders, tombstones.folders, rt.folders);
  const localTime = Number(local.updatedAt || 0), remoteTime = Number(remote.updatedAt || 0);
  const localSettingsTime = Number(local.settingsUpdatedAt || 0), remoteSettingsTime = Number(remote.settingsUpdatedAt || 0);
  return { docs, folders, st: localSettingsTime >= remoteSettingsTime ? (local.st || {}) : (remote.st || {}), tombstones, updatedAt: Math.max(localTime, remoteTime), settingsUpdatedAt: Math.max(localSettingsTime, remoteSettingsTime) };
}
async function writeBackup(access: string, folderId: string, fileId: string | null, snapshot: any) {
  const content = JSON.stringify(snapshot);
  if (fileId) {
    await drive(access, `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: content });
    return fileId;
  }
  const boundary = 'nawisa_' + crypto.randomUUID().replaceAll('-', '');
  const metadata = JSON.stringify({ name: 'nawisa-backup.json', mimeType: 'application/json', parents: [folderId] });
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  const made: any = await drive(access, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  return made.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  if (url.searchParams.get('action') === 'callback' && req.method === 'GET') {
    const code = url.searchParams.get('code'), state = url.searchParams.get('state');
    if (!code || !state) return new Response('Missing OAuth code/state', { status: 400 });
    const { data: stateRow } = await admin.from('drive_oauth_states').select('*').eq('state', state).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!stateRow) return new Response('Invalid or expired OAuth state', { status: 400 });
    await admin.from('drive_oauth_states').delete().eq('state', state);
    try {
      const tokens = await googleToken(code);
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Revoke app access and reconnect with consent.');
      const encrypted = await encrypt(tokens.refresh_token);
      const { error } = await admin.from('drive_tokens').upsert({ user_id: stateRow.user_id, encrypted_refresh_token: encrypted, connected_at: new Date().toISOString() });
      if (error) throw error;
      return Response.redirect(`${stateRow.return_to}?drive=connected`, 302);
    } catch (e) { return Response.redirect(`${stateRow.return_to}?drive=error`, 302); }
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization') || '';
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);
  const action = url.searchParams.get('action');
  try {
    const body = await req.json().catch(() => ({}));
    if (action === 'connect-url') {
      const returnTo = String(body.returnTo || '');
      const allowed = (Deno.env.get('APP_ORIGIN') || '').split(',').map(x => x.trim()).filter(Boolean);
      const parsed = new URL(returnTo);
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') throw new Error('Return URL must use HTTPS');
      if (allowed.length && !allowed.includes(parsed.origin)) throw new Error('Return origin is not allowed');
      const state = crypto.randomUUID();
      const { error } = await admin.from('drive_oauth_states').insert({ state, user_id: user.id, return_to: parsed.origin + parsed.pathname, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
      if (error) throw error;
      const params = new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, redirect_uri: REDIRECT_URI, response_type: 'code', scope: DRIVE_SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }
    if (action === 'status') {
      const { data } = await admin.from('drive_tokens').select('user_id').eq('user_id', user.id).maybeSingle();
      return json({ connected: !!data });
    }
    if (action === 'disconnect') {
      await admin.from('drive_tokens').delete().eq('user_id', user.id);
      return json({ disconnected: true });
    }
    if (action === 'sync') {
      const local = body.snapshot;
      if (!local || !Array.isArray(local.docs) || !Array.isArray(local.folders)) throw new Error('Invalid application snapshot');
      const access = await getAccessToken(user.id);
      const folderId = await getOrCreateFolder(access);
      const { fileId, snapshot: remote } = await readBackup(access, folderId);
      const merged = mergeSnapshots(local, remote);
      const backupId = await writeBackup(access, folderId, fileId, merged);
      await admin.from('drive_tokens').update({ drive_folder_id: folderId, backup_file_id: backupId, last_sync_at: new Date().toISOString() }).eq('user_id', user.id);
      return json({ snapshot: merged, syncedAt: new Date().toISOString() });
    }
    return json({ error: 'Unknown action' }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 400); }
});
