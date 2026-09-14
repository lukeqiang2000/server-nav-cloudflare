// functions/api/[[path]].js
// Cloudflare Pages Functions 导航面板 API

const PASSWORD_SALT = '#ServerNav_Salt_2026';
const DEFAULT_ADMIN_PASSWORD = 'dolphin171020#A';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const ADMIN_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000;

const DEFAULT_JOIN_TEXT = '欢迎加入服务器，请在资源中心下载整合包与启动器后连接服务器。';
const DEFAULT_CHANGELOGS = [
  { version: 'v1.2', items: ['Cloudflare API 版本', '支持用户系统、反馈、建议、更新日志与卡片配置'] }
];

const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="#1e293b"/>
  <circle cx="64" cy="48" r="24" fill="#6366f1"/>
  <ellipse cx="64" cy="104" rx="42" ry="26" fill="#6366f1"/>
</svg>`;

export async function onRequest(context) {
  return handleRequest(context.request, context.env);
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname.replace(/^\/api\/?/, '');

  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': url.origin,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true'
      }
    });
  }

  try {
    if (path === 'stream' && method === 'GET') return handleStream();

    if (path.startsWith('uploads/') && method === 'GET') {
      return handleUploads(request, env, path, url);
    }

    if ((path === 'login' || path === 'admin/login') && method === 'POST') return handleAdminLogin(request, env);
    if (path === 'admin/me' && method === 'GET') {
      return json({ authenticated: await requireAdmin(request, env) });
    }

    if (!getKV(env)) {
      return json({ error: '未绑定 KV 命名空间 NAV_KV 或 MY_KV' }, 500);
    }

    if (path === 'site-config') {
      if (method === 'GET') return handleSiteConfigGet(env);
      if (method === 'PATCH') return handleSiteConfigPatch(request, env);
    }

    if (path === 'cards') {
      if (method === 'GET') return handleCardsGet(env);
      if (method === 'POST') return handleCardsPost(request, env);
    }

    if (path === 'changelogs') {
      if (method === 'GET') return handleChangelogsGet(env);
      if (method === 'POST') return handleChangelogsPost(request, env);
    }
    if (path.startsWith('changelogs/') && method === 'PATCH') {
      return handleChangelogsPatch(request, env, path);
    }

    if (path === 'notices') {
      if (method === 'GET') return handleNoticesGet(env);
      if (method === 'POST') return handleNoticesPost(request, env);
    }

    if (path === 'bugs') {
      if (method === 'GET') return handleBugsGet(env);
      if (method === 'POST') return handleBugsPost(request, env);
    }
    if (path.startsWith('bugs/') && method === 'PATCH') {
      return handleBugResolve(request, env, path);
    }

    if (path === 'suggestions') {
      if (method === 'GET') return handleSuggestionsGet(env);
      if (method === 'POST') return handleSuggestionsPost(request, env);
    }
    if (path.startsWith('suggestions/') && method === 'PATCH') {
      return handleSuggestionStatus(request, env, path);
    }

    // 下载中心
    if (path === 'download/list' && method === 'GET') return handleDownloadList(request, env, url);
    if (path === 'download/upload' && method === 'POST') return handleDownloadUpload(request, env);
    if (path === 'download/delete' && method === 'POST') return handleDownloadDelete(request, env);
    if (path === 'uploads' && method === 'GET') return handleDownloadList(request, env, url);
    if (path.startsWith('uploads/') && method === 'GET') return handleFileGet(request, env, `files/${path.slice('uploads/'.length)}`, url);
    if (path === 'file/upload' && method === 'POST') return handleDownloadUpload(request, env);
    if (path === 'file/delete' && method === 'POST') return handleFileDelete(request, env);
    if (path === 'file/batch-delete' && method === 'POST') return handleFileBatchDelete(request, env);
    if (path === 'file/rename' && method === 'POST') return handleFileRename(request, env);
    if (path === 'file/batch-download' && method === 'POST') return handleFileBatchDownload(request, env);
    if (path === 'folder/create' && method === 'POST') return handleFolderCreate(request, env);
    if (path === 'folder/delete' && method === 'POST') return handleFolderDelete(request, env);
    if (path === 'folder/rename' && method === 'POST') return handleFolderRename(request, env);
    if (path === 'folder/verify' && method === 'POST') return handleFolderVerify(request, env);
    if (path.startsWith('files/') && method === 'GET') return handleFileGet(request, env, path, url);

    // 聊天室
    if (path === 'chat/messages' && method === 'GET') return handleChatGet(env, url);
    if (path === 'chat/messages' && method === 'POST') return handleChatPost(request, env);

    if (path === 'auth/register' && method === 'POST') return handleAuthRegister(request, env);
    if (path === 'auth/login' && method === 'POST') return handleAuthLogin(request, env);
    if (path === 'auth/logout' && method === 'POST') return handleAuthLogout(request, env);
    if (path === 'auth/me' && method === 'GET') return handleAuthMe(request, env);

    if (path === 'users/profile' && method === 'PUT') return handleUserProfileUpdate(request, env);
    if (path === 'users/avatar' && method === 'POST') return handleUserAvatarUpload(request, env);
    if (path === 'users/background' && method === 'POST') return handleUserBackgroundUpload(request, env);
    if (path === 'users/search' && method === 'GET') return handleUserSearch(request, env, url);
    if (path.startsWith('users/') && method === 'GET') return handleUserGet(request, env, path);

    return json({ error: 'API Not Found' }, 404);
  } catch (err) {
    console.error(err);
    return json({ error: err.message || '服务器内部错误' }, 500);
  }
}

/* ================= 基础工具 ================= */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

async function getJSON(env, key, fallback) {
  const value = await getKV(env).get(key, { type: 'json' });
  return value === null ? fallback : value;
}

async function putJSON(env, key, value) {
  await getKV(env).put(key, JSON.stringify(value));
}

function getKV(env) {
  return env.NAV_KV || env.MY_KV;
}

function getResourceBucket(env) {
  return env.FILES || env.UPLOADS;
}

function getSecret(env) {
  return env.SESSION_SECRET || env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  return sha256Hex(password + PASSWORD_SALT);
}

async function verifyAdminPassword(password, env) {
  const inputHash = await sha256Hex(password + PASSWORD_SALT);
  if (env.ADMIN_PASSWORD_HASH) return inputHash === env.ADMIN_PASSWORD_HASH;
  const adminPassword = env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminHash = await sha256Hex(adminPassword + PASSWORD_SALT);
  return inputHash === adminHash;
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(signature);
}

async function createToken(payload, env) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSign(body, getSecret(env));
  return `${body}.${sig}`;
}

async function verifyToken(token, env) {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = await hmacSign(body, getSecret(env));
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

async function createSessionToken(userId, env) {
  return createToken({ userId, exp: Date.now() + SESSION_MAX_AGE * 1000 }, env);
}

async function verifySessionToken(token, env) {
  const payload = await verifyToken(token, env);
  return payload?.userId || null;
}

async function createAdminToken(env) {
  return createToken({ admin: true, exp: Date.now() + ADMIN_TOKEN_MAX_AGE }, env);
}

async function verifyAdminToken(token, env) {
  const payload = await verifyToken(token, env);
  return Boolean(payload && payload.admin);
}

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ')
    ? auth.slice(7).trim()
    : getCookie(request, 'admin_token');
  return verifyAdminToken(token, env);
}

function adminCookie(token, url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_TOKEN_MAX_AGE / 1000}${secure}`;
}

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function sessionCookie(token, url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `session_token=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}${secure}`;
}

function clearSessionCookie(url) {
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

function randomId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/* ================= 用户存储 ================= */

function userKey(userId) { return `user:${userId}`; }
function userNameKey(username) { return `user:name:${username.toLowerCase()}`; }

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    avatar: user.avatar || '/api/uploads/default_avatar.png',
    background: user.background || '',
    bio: user.bio || '',
    createdAt: user.createdAt,
    lastActive: user.lastActive
  };
}

async function getUserById(env, userId) {
  if (!userId) return null;
  return getKV(env).get(userKey(userId), { type: 'json' });
}

async function getUserByUsername(env, username) {
  const id = await getKV(env).get(userNameKey(username));
  if (!id) return null;
  return getUserById(env, id);
}

async function saveUser(env, user) {
  await getKV(env).put(userKey(user.id), JSON.stringify(user));
  await getKV(env).put(userNameKey(user.username), user.id);
}

async function getCurrentUser(request, env) {
  const token = getCookie(request, 'session_token');
  if (!token) return null;
  const userId = await verifySessionToken(token, env);
  if (!userId) return null;
  return getUserById(env, userId);
}

/* ================= 管理员登录 ================= */

async function handleAdminLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const password = String(body.password || '');
  if (!password) return json({ error: '密码不能为空' }, 400);
  const ok = await verifyAdminPassword(password, env);
  if (!ok) return json({ error: '密码错误！' }, 401);
  const token = await createAdminToken(env);
  return json({ success: true, token }, 200, {
    'Set-Cookie': adminCookie(token, new URL(request.url))
  });
}

/* ================= SSE ================= */

function handleStream() {
  const body = `retry: 30000\n\ndata: ${JSON.stringify({ type: 'connected' })}\n\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  });
}

/* ================= 上传资源 ================= */

async function handleUploads(request, env, path, url) {
  const key = path.slice('uploads/'.length);
  if (!key) return new Response('Not Found', { status: 404 });

  if (key === 'default_avatar.png') {
    return new Response(DEFAULT_AVATAR_SVG, {
      headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }
    });
  }

  if (!env.UPLOADS) return new Response('未绑定 R2 桶 UPLOADS', { status: 500 });

  const object = await env.UPLOADS.get(key);
  if (!object) return new Response('Not Found', { status: 404 });

  const headers = {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000'
  };

  if (url.searchParams.get('download') === '1') {
    const filename = key.split('/').pop() || key;
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }

  return new Response(object.body, { headers });
}

async function saveUpload(env, file) {
  if (!env.UPLOADS) throw new Error('未绑定 R2 桶 UPLOADS');
  const ext = file.name && file.name.includes('.')
    ? '.' + file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '') : '';
  const key = Date.now() + '_' + randomId().replace(/-/g, '') + ext;
  await env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' }
  });
  return key;
}

/* ================= 站点配置 ================= */

async function handleSiteConfigGet(env) {
  return json(await getJSON(env, 'site-config', { joinServerText: DEFAULT_JOIN_TEXT }));
}

async function handleSiteConfigPatch(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const body = await request.json().catch(() => ({}));
  const joinServerText = String(body.joinServerText || '').trim();
  if (!joinServerText) return json({ error: '加入服务器文字不能为空' }, 400);
  const config = { ...(await getJSON(env, 'site-config', { joinServerText: DEFAULT_JOIN_TEXT })), joinServerText };
  await putJSON(env, 'site-config', config);
  return json({ success: true, config });
}

/* ================= 卡片 ================= */

async function handleCardsGet(env) {
  return json(await getJSON(env, 'cards', {}));
}

async function handleCardsPost(request, env) {
  try {
    if (!(await requireAdmin(request, env))) return json({ error: '未授权或登录已过期' }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: '请求数据格式错误' }, 400); }
    const id = String(body.id || '').trim();
    if (!id) return json({ error: '缺少板块 ID' }, 400);
    const cards = await getJSON(env, 'cards', {});
    const previous = cards[id] || {};
    const normalizeI18n = (source, prev) => {
      const result = { ...(prev || {}) };
      if (source && typeof source === 'object') {
        Object.keys(source).forEach(lang => {
          const value = source[lang];
          if (value !== undefined && value !== null) result[lang] = String(value);
        });
      }
      return result;
    };
    cards[id] = {
      ...previous,
      title: body.title !== undefined ? String(body.title) : (previous.title || ''),
      desc: body.desc !== undefined ? String(body.desc) : (previous.desc || ''),
      titleI18n: normalizeI18n(body.titleI18n, previous.titleI18n),
      descI18n: normalizeI18n(body.descI18n, previous.descI18n),
      url: body.url !== undefined ? String(body.url) : (previous.url || ''),
      icon: body.icon !== undefined ? String(body.icon) : (previous.icon || '')
    };
    await putJSON(env, 'cards', cards);
    return json({ success: true, card: cards[id] });
  } catch (err) {
    return json({ error: '保存失败：' + (err.message || '服务器内部错误') }, 500);
  }
}

/* ================= 更新日志 ================= */

async function handleChangelogsGet(env) {
  return json(await getJSON(env, 'changelogs', DEFAULT_CHANGELOGS));
}

async function handleChangelogsPost(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const body = await request.json().catch(() => ({}));
  const version = String(body.version || '').trim();
  const items = Array.isArray(body.items) ? body.items.map(i => String(i).trim()).filter(Boolean) : [];
  if (!version || items.length === 0) return json({ error: '参数不正确' }, 400);
  const logs = await getJSON(env, 'changelogs', DEFAULT_CHANGELOGS);
  const newLog = { version, items };
  logs.unshift(newLog);
  await putJSON(env, 'changelogs', logs);
  return json({ success: true, log: newLog });
}

async function handleChangelogsPatch(request, env, path) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const version = decodeURIComponent(path.slice('changelogs/'.length));
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items.map(i => String(i).trim()).filter(Boolean) : [];
  if (!version || items.length === 0) return json({ error: '更新内容不能为空' }, 400);
  const logs = await getJSON(env, 'changelogs', DEFAULT_CHANGELOGS);
  const index = logs.findIndex(item => String(item.version) === version);
  if (index < 0) return json({ error: '更新日志不存在' }, 404);
  logs[index].items = items;
  await putJSON(env, 'changelogs', logs);
  return json({ success: true, log: logs[index] });
}

/* ================= 公告 ================= */

async function handleNoticesGet(env) {
  return json({ success: true, data: await getJSON(env, 'notices', []) });
}

async function handleNoticesPost(request, env) {
  if (!(await requireAdmin(request, env))) return json({ success: false, message: '未授权' }, 401);
  const body = await request.json().catch(() => ({}));
  const notices = Array.isArray(body.notices) ? body.notices : null;
  if (!notices) return json({ success: false, message: '数据格式错误' }, 400);
  await putJSON(env, 'notices', notices);
  return json({ success: true, message: '公告保存成功' });
}

/* ================= Bug ================= */

async function handleBugsGet(env) {
  return json(await getJSON(env, 'bugs', []));
}

async function handleBugsPost(request, env) {
  const body = await request.json().catch(() => ({}));
  const bugs = await getJSON(env, 'bugs', []);
  const submittedAt = new Date();
  const newBug = {
    id: Date.now(),
    name: String(body.name || '').trim(),
    dateTime: body.dateTime || submittedAt.toISOString().slice(0, 16).replace('T', ' '),
    section: body.section || '',
    type: body.type || '',
    detail: body.detail || '',
    submittedAt: submittedAt.toISOString(),
    resolved: false
  };
  bugs.unshift(newBug);
  await putJSON(env, 'bugs', bugs);
  return json({ success: true, bug: newBug });
}

async function handleBugResolve(request, env, path) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const id = path.split('/')[1];
  if (!id) return json({ error: '缺少 Bug ID' }, 400);
  const bugs = await getJSON(env, 'bugs', []);
  const index = bugs.findIndex(b => String(b.id) === String(id));
  if (index < 0) return json({ error: 'Bug 未找到' }, 404);
  bugs[index].resolved = true;
  await putJSON(env, 'bugs', bugs);
  return json({ success: true });
}

/* ================= 建议 ================= */

async function handleSuggestionsGet(env) {
  return json(await getJSON(env, 'suggestions', []));
}

async function handleSuggestionsPost(request, env) {
  const body = await request.json().catch(() => ({}));
  const suggestions = await getJSON(env, 'suggestions', []);
  const newSuggestion = {
    id: Date.now(),
    name: body.name || '',
    dateTime: body.dateTime || '',
    section: body.section || '',
    priority: body.priority || '',
    detail: body.detail || '',
    status: 'pending'
  };
  suggestions.unshift(newSuggestion);
  await putJSON(env, 'suggestions', suggestions);
  return json({ success: true, suggestion: newSuggestion });
}

async function handleSuggestionStatus(request, env, path) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const id = path.split('/')[1];
  const body = await request.json().catch(() => ({}));
  const status = body.status;
  if (!id || !['pending', 'accepted', 'rejected'].includes(status)) return json({ error: '无效的状态值' }, 400);
  const suggestions = await getJSON(env, 'suggestions', []);
  const index = suggestions.findIndex(s => String(s.id) === String(id));
  if (index < 0) return json({ error: '建议未找到' }, 404);
  suggestions[index].status = status;
  await putJSON(env, 'suggestions', suggestions);
  return json({ success: true });
}

/* ================= 下载中心 ================= */

async function handleDownloadList(request, env, url) {
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  let requestedPath = url.searchParams.get('path') || '';
  if (!requestedPath) {
    const refererHeader = request.headers.get('Referer') || '';
    const referer = refererHeader ? new URL(refererHeader).pathname : '';
    if (referer.startsWith('/download/')) requestedPath = decodeURIComponent(referer.slice('/download/'.length));
  }
  const relPath = normalizeFolderKey(requestedPath);
  if (!relPath) {
    const marker = `files/.folders/${encodeURIComponent('Userfolder')}`;
    if (!(await bucket.head(marker))) {
      await bucket.put(marker, JSON.stringify({ key: 'Userfolder', createdAt: new Date().toISOString() }), {
        httpMetadata: { contentType: 'application/json' }
      });
    }

  }
  const prefix = `files/${relPath ? `${relPath}/` : ''}`;
  const list = await bucket.list({ prefix });
  const files = list.objects.map(item => {
    const rawName = item.key.slice(prefix.length);
    if (!rawName || rawName.includes('/') || item.key.startsWith('files/.folders/')) return null;
    const name = rawName.replace(/^\d+_[a-f0-9]+_/, '');
    return {
      key: item.key,
      name: name || rawName,
      size: item.size,
      uploaded: item.uploaded ? item.uploaded.toISOString() : new Date().toISOString()
    };
  }).filter(Boolean);
  const markers = await bucket.list({ prefix: 'files/.folders/' });
  const folders = markers.objects
    .map(item => decodeURIComponent(item.key.slice('files/.folders/'.length)))
    .filter(key => {
      const parent = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '';
      return parent === relPath;
    });
  files.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
  return json({ files, folders });
}

async function handleDownloadUpload(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const form = await request.formData();
  const files = form.getAll('files').concat(form.getAll('file'));
  if (!files.length) return json({ error: '未收到文件' }, 400);
  let count = 0;
  for (const file of files) {
    if (typeof file === 'string') continue;
    const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '_');
    const relPath = String(form.get('relPath') || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (relPath.includes('..')) return json({ error: '非法目录' }, 400);
    const key = 'files/' + (relPath ? `${relPath}/` : '') + Date.now() + '_' + Math.random().toString(16).slice(2, 10) + '_' + safeName;
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'application/octet-stream' }
    });
    count++;
  }
  return json({ success: true, count });
}

async function handleDownloadDelete(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || '').trim();
  if (!key || !key.startsWith('files/')) return json({ error: '非法路径' }, 400);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  await bucket.delete(key);
  return json({ success: true });
}

async function handleFileGet(request, env, path, url) {
  const bucket = getResourceBucket(env);
  if (!bucket) return new Response('未绑定资源 R2 桶 FILES', { status: 500 });
  const key = decodeURIComponent(path.slice('files/'.length));
  if (!key || key.includes('..') || key.startsWith('/')) return new Response('非法路径', { status: 400 });
  const object = await bucket.get(key.startsWith('files/') ? key : `files/${key}`);
  if (!object) return new Response('Not Found', { status: 404 });
  const headers = {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=31536000'
  };
  if (url.searchParams.get('download') === '1') {
    const filename = key.split('/').pop() || key;
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
  }
  return new Response(object.body, { headers });
}

async function handleFileDelete(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || '').trim();
  if (!key || key.includes('..')) return json({ error: '非法路径' }, 400);
  await bucket.delete(key.startsWith('files/') ? key : `files/${key}`);
  return json({ success: true });
}

async function handleFileBatchDelete(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const keys = Array.isArray(body.keys) ? [...new Set(body.keys.map(value => String(value || '').trim()).filter(Boolean))] : [];
  if (!keys.length || keys.some(key => key.includes('..'))) return json({ error: '未选择有效文件' }, 400);
  await bucket.delete(keys.map(key => key.startsWith('files/') ? key : `files/${key}`));
  return json({ success: true, deleted: keys });
}

async function handleFileRename(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const oldKey = String(body.key || '').trim();
  const newName = String(body.newName || body.name || '').trim();
  if (!oldKey || !newName || oldKey.includes('..') || newName.includes('/') || newName.includes('\\')) {
    return json({ error: '非法文件名' }, 400);
  }
  const sourceKey = oldKey.startsWith('files/') ? oldKey : `files/${oldKey}`;
  const targetKey = `files/${newName}`;
  const source = await bucket.get(sourceKey);
  if (!source) return json({ error: '文件不存在' }, 404);
  await bucket.put(targetKey, source.body, { httpMetadata: source.httpMetadata });
  await bucket.delete(sourceKey);
  return json({ success: true, key: targetKey });
}

async function handleFileBatchDownload(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  return json({ error: 'Cloudflare 版本暂不支持打包下载，请逐个下载文件' }, 501);
}

function normalizeFolderKey(value) {
  const key = String(value || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!key || key.includes('..') || key.startsWith('shared/')) return '';
  return key;
}

async function handleFolderCreate(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const parent = normalizeFolderKey(body.relPath);
  const name = String(body.folderName || '').trim();
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return json({ error: '非法文件夹名称' }, 400);
  }
  const key = [parent, name].filter(Boolean).join('/');
  await bucket.put(`files/.folders/${encodeURIComponent(key)}`, JSON.stringify({
    key, private: Boolean(body.isPrivate), password: String(body.password || '')
  }), { httpMetadata: { contentType: 'application/json' } });
  return json({ success: true, key });
}

async function handleFolderDelete(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const folder = normalizeFolderKey(body.folderKey);
  if (!folder) return json({ error: '非法文件夹路径' }, 400);
  const prefix = `files/${folder}/`;
  const objects = await bucket.list({ prefix });
  await bucket.delete(objects.objects.map(object => object.key));
  await bucket.delete(`files/.folders/${encodeURIComponent(folder)}`);
  return json({ success: true });
}

async function handleFolderRename(request, env) {
  if (!(await requireAdmin(request, env))) return json({ error: '未授权' }, 401);
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const oldKey = normalizeFolderKey(body.folderKey);
  const newName = String(body.newName || '').trim();
  if (!oldKey || !newName || newName.includes('/') || newName.includes('\\') || newName.includes('..')) {
    return json({ error: '非法文件夹名称' }, 400);
  }
  const parent = oldKey.includes('/') ? oldKey.slice(0, oldKey.lastIndexOf('/')) : '';
  const newKey = [parent, newName].filter(Boolean).join('/');
  const objects = await bucket.list({ prefix: `files/${oldKey}/` });
  for (const object of objects.objects) {
    const source = await bucket.get(object.key);
    if (source) await bucket.put(`files/${newKey}/${object.key.slice(`files/${oldKey}/`.length)}`, source.body, { httpMetadata: source.httpMetadata });
  }
  await bucket.delete(objects.objects.map(object => object.key));
  await bucket.delete(`files/.folders/${encodeURIComponent(oldKey)}`);
  await bucket.put(`files/.folders/${encodeURIComponent(newKey)}`, JSON.stringify({ key: newKey }), {
    httpMetadata: { contentType: 'application/json' }
  });
  return json({ success: true, key: newKey });
}

async function handleFolderVerify(request, env) {
  const bucket = getResourceBucket(env);
  if (!bucket) return json({ error: '未绑定资源 R2 桶 FILES' }, 500);
  const body = await request.json().catch(() => ({}));
  const key = normalizeFolderKey(body.folderKey);
  const object = key ? await bucket.get(`files/.folders/${encodeURIComponent(key)}`) : null;
  if (!object) return json({ error: '文件夹不存在' }, 404);
  const data = await object.json();
  if (data.private && String(body.password || '') !== String(data.password || '')) {
    return json({ error: '密码错误！' }, 403);
  }
  return json({ success: true });
}

/* ================= 聊天室 ================= */

const CHAT_MAX_MESSAGES = 100;
const CHAT_KEY = 'chat:messages';

async function handleChatGet(env, url) {
  const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
  const messages = await getJSON(env, CHAT_KEY, []);
  const filtered = since > 0 ? messages.filter(m => m.timestamp > since) : messages.slice(-50);
  return json({ messages: filtered });
}

async function handleChatPost(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: '请先登录' }, 401);
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').trim().slice(0, 500);
  if (!text) return json({ error: '消息不能为空' }, 400);
  const messages = await getJSON(env, CHAT_KEY, []);
  const msg = {
    id: randomId(),
    userId: user.id,
    username: user.displayName || user.username,
    avatar: user.avatar || '/api/uploads/default_avatar.png',
    text,
    timestamp: Date.now()
  };
  messages.push(msg);
  if (messages.length > CHAT_MAX_MESSAGES) messages.splice(0, messages.length - CHAT_MAX_MESSAGES);
  await putJSON(env, CHAT_KEY, messages);
  return json({ success: true, message: msg });
}

/* ================= 用户认证 ================= */

async function handleAuthRegister(request, env) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const displayName = String(body.displayName || username).trim() || username;
  if (!username || !password) return json({ error: '用户名和密码不能为空' }, 400);
  if (username.length < 3) return json({ error: '用户名至少3个字符' }, 400);
  if (password.length < 6) return json({ error: '密码至少6个字符' }, 400);
  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) return json({ error: '用户名包含非法字符' }, 400);
  const exists = await getKV(env).get(userNameKey(username));
  if (exists) return json({ error: '用户名已被占用' }, 400);
  const now = new Date().toISOString();
  const user = {
    id: randomId(), username, displayName,
    passwordHash: await hashPassword(password),
    avatar: '/api/uploads/default_avatar.png',
    background: '',
    bio: '这个人很懒，什么都没有写~',
    createdAt: now, lastActive: now
  };
  await saveUser(env, user);
  const token = await createSessionToken(user.id, env);
  return json({ success: true, user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token, new URL(request.url)) });
}

async function handleAuthLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json({ error: '用户名和密码不能为空' }, 400);
  const user = await getUserByUsername(env, username);
  if (!user) return json({ error: '用户名或密码错误' }, 401);
  const inputHash = await hashPassword(password);
  if (inputHash !== user.passwordHash) return json({ error: '用户名或密码错误' }, 401);
  user.lastActive = new Date().toISOString();
  await getKV(env).put(userKey(user.id), JSON.stringify(user));
  const token = await createSessionToken(user.id, env);
  return json({ success: true, user: publicUser(user) }, 200, { 'Set-Cookie': sessionCookie(token, new URL(request.url)) });
}

async function handleAuthLogout(request, env) {
  return json({ success: true }, 200, { 'Set-Cookie': clearSessionCookie(new URL(request.url)) });
}

async function handleAuthMe(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: '未登录' }, 401);
  return json(publicUser(user));
}

/* ================= 用户资料 ================= */

async function handleUserProfileUpdate(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: '未登录' }, 401);
  const body = await request.json().catch(() => ({}));
  if (body.displayName !== undefined) user.displayName = String(body.displayName || '').trim() || user.username;
  if (body.bio !== undefined) user.bio = String(body.bio || '').trim();
  user.lastActive = new Date().toISOString();
  await getKV(env).put(userKey(user.id), JSON.stringify(user));
  return json({ success: true, user: publicUser(user) });
}

async function handleUserAvatarUpload(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: '未登录' }, 401);
  const form = await request.formData();
  const file = form.get('avatar');
  if (!file || typeof file === 'string') return json({ error: '请选择文件' }, 400);
  const key = await saveUpload(env, file);
  user.avatar = `/api/uploads/${key}`;
  user.lastActive = new Date().toISOString();
  await getKV(env).put(userKey(user.id), JSON.stringify(user));
  return json({ success: true, avatar: user.avatar, user: publicUser(user) });
}

async function handleUserBackgroundUpload(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) return json({ error: '未登录' }, 401);
  const form = await request.formData();
  const file = form.get('background');
  if (!file || typeof file === 'string') return json({ error: '请选择文件' }, 400);
  const key = await saveUpload(env, file);
  user.background = `/api/uploads/${key}`;
  user.lastActive = new Date().toISOString();
  await getKV(env).put(userKey(user.id), JSON.stringify(user));
  return json({ success: true, background: user.background, user: publicUser(user) });
}

async function handleUserSearch(request, env, url) {
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return json([]);
  const list = await getKV(env).list({ prefix: 'user:' });
  const results = [];
  for (const key of list.keys) {
    if (key.name.startsWith('user:name:')) continue;
    const user = await getKV(env).get(key.name, { type: 'json' });
    if (!user) continue;
    const username = String(user.username || '').toLowerCase();
    const displayName = String(user.displayName || '').toLowerCase();
    if (username.includes(q) || displayName.includes(q)) results.push(publicUser(user));
    if (results.length >= 10) break;
  }
  return json(results);
}

async function handleUserGet(request, env, path) {
  const userId = decodeURIComponent(path.slice('users/'.length));
  const user = await getUserById(env, userId);
  if (!user) return json({ error: '用户不存在' }, 404);
  return json(publicUser(user));
}