// functions/api/[[path]].js
// Cloudflare Pages Functions / Workers 可用的导航面板 API
// 处理 /api/* 下的所有请求。

const PASSWORD_SALT = '#ServerNav_Salt_2026';
const DEFAULT_ADMIN_PASSWORD = 'dolphin171020#A';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 天，秒
const ADMIN_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 小时，毫秒

const DEFAULT_JOIN_TEXT = '欢迎加入服务器，请在资源中心下载整合包与启动器后连接服务器。';
const DEFAULT_CHANGELOGS = [
  {
    version: 'v1.2',
    items: [
      'Cloudflare API 版本',
      '支持用户系统、反馈、建议、更新日志与卡片配置',
    ],
  },
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
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  try {
    if (path === 'stream' && method === 'GET') {
      return handleStream();
    }

    if (path.startsWith('uploads/') && method === 'GET') {
      return handleUploads(request, env, path);
    }

    if (!env.NAV_KV) {
      return json({ error: '未绑定 KV 命名空间 NAV_KV，请在 Cloudflare 控制台绑定。' }, 500);
    }

    if (path === 'login' && method === 'POST') {
      return handleAdminLogin(request, env);
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

    if (path === 'auth/register' && method === 'POST') {
      return handleAuthRegister(request, env);
    }
    if (path === 'auth/login' && method === 'POST') {
      return handleAuthLogin(request, env);
    }
    if (path === 'auth/logout' && method === 'POST') {
      return handleAuthLogout(request, env);
    }
    if (path === 'auth/me' && method === 'GET') {
      return handleAuthMe(request, env);
    }

    if (path === 'users/profile' && method === 'PUT') {
      return handleUserProfileUpdate(request, env);
    }
    if (path === 'users/avatar' && method === 'POST') {
      return handleUserAvatarUpload(request, env);
    }
    if (path === 'users/background' && method === 'POST') {
      return handleUserBackgroundUpload(request, env);
    }
    if (path === 'users/search' && method === 'GET') {
      return handleUserSearch(request, env, url);
    }
    if (path.startsWith('users/') && method === 'GET') {
      return handleUserGet(request, env, path);
    }

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
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

async function getJSON(env, key, fallback) {
  const value = await env.NAV_KV.get(key, { type: 'json' });
  return value === null ? fallback : value;
}

async function putJSON(env, key, value) {
  await env.NAV_KV.put(key, JSON.stringify(value));
}

function getSecret(env) {
  return env.SESSION_SECRET || env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password) {
  return sha256Hex(password + PASSWORD_SALT);
}

async function verifyAdminPassword(password, env) {
  const inputHash = await sha256Hex(password + PASSWORD_SALT);

  if (env.ADMIN_PASSWORD_HASH) {
    return inputHash === env.ADMIN_PASSWORD_HASH;
  }

  const adminPassword = env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminHash = await sha256Hex(adminPassword + PASSWORD_SALT);
  return inputHash === adminHash;
}

function base64UrlEncode(input) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  const pad = str.length % 4 ? '='.repeat(4 - (str.length % 4)) : '';
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new TextDecoder().decode(bytes);
}

async function hmacSign(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

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
  } catch {
    return null;
  }
}

async function createSessionToken(userId, env) {
  return createToken(
    {
      userId,
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    },
    env
  );
}

async function verifySessionToken(token, env) {
  const payload = await verifyToken(token, env);
  return payload?.userId || null;
}

async function createAdminToken(env) {
  return createToken(
    {
      admin: true,
      exp: Date.now() + ADMIN_TOKEN_MAX_AGE,
    },
    env
  );
}

async function verifyAdminToken(token, env) {
  const payload = await verifyToken(token, env);
  return Boolean(payload && payload.admin);
}

async function requireAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return verifyAdminToken(token, env);
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

function userKey(userId) {
  return `user:${userId}`;
}

function userNameKey(username) {
  return `user:name:${username.toLowerCase()}`;
}

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
    lastActive: user.lastActive,
  };
}

async function getUserById(env, userId) {
  if (!userId) return null;
  return env.NAV_KV.get(userKey(userId), { type: 'json' });
}

async function getUserByUsername(env, username) {
  const id = await env.NAV_KV.get(userNameKey(username));
  if (!id) return null;
  return getUserById(env, id);
}

async function saveUser(env, user) {
  await env.NAV_KV.put(userKey(user.id), JSON.stringify(user));
  await env.NAV_KV.put(userNameKey(user.username), user.id);
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

  if (!password) {
    return json({ error: '密码不能为空' }, 400);
  }

  const ok = await verifyAdminPassword(password, env);
  if (!ok) {
    return json({ error: '密码错误！' }, 401);
  }

  const token = await createAdminToken(env);
  return json({ success: true, token });
}

/* ================= SSE ================= */

function handleStream() {
  const body = `retry: 30000\n\ndata: ${JSON.stringify({ type: 'connected' })}\n\n`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

/* ================= 上传资源 ================= */

async function handleUploads(request, env, path) {
  const key = path.slice('uploads/'.length);
  if (!key) return new Response('Not Found', { status: 404 });

  if (key === 'default_avatar.png') {
    return new Response(DEFAULT_AVATAR_SVG, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  if (!env.UPLOADS) {
    return new Response('未绑定 R2 桶 UPLOADS', { status: 500 });
  }

  const object = await env.UPLOADS.get(key);
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}

async function saveUpload(env, file) {
  if (!env.UPLOADS) {
    throw new Error('未绑定 R2 桶 UPLOADS');
  }

  const ext = file.name && file.name.includes('.')
    ? '.' + file.name.split('.').pop().replace(/[^a-zA-Z0-9]/g, '')
    : '';

  const key = Date.now() + '_' + randomId().replace(/-/g, '') + ext;

  await env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  return key;
}

/* ================= 站点配置 ================= */

async function handleSiteConfigGet(env) {
  const config = await getJSON(env, 'site-config', {
    joinServerText: DEFAULT_JOIN_TEXT,
  });
  return json(config);
}

async function handleSiteConfigPatch(request, env) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: '未授权或登录已过期' }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const joinServerText = String(body.joinServerText || '').trim();

  if (!joinServerText) {
    return json({ error: '加入服务器文字不能为空' }, 400);
  }

  const config = {
    ...(await getJSON(env, 'site-config', { joinServerText: DEFAULT_JOIN_TEXT })),
    joinServerText,
  };

  await putJSON(env, 'site-config', config);
  return json({ success: true, config });
}

/* ================= 卡片 ================= */

async function handleCardsGet(env) {
  const cards = await getJSON(env, 'cards', {});
  return json(cards);
}

async function handleCardsPost(request, env) {
  try {
    if (!(await requireAdmin(request, env))) {
      return json({ error: '未授权或登录已过期' }, 401);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: '请求数据格式错误' }, 400);
    }

    const id = String(body.id || '').trim();
    if (!id) return json({ error: '缺少板块 ID' }, 400);

    const cards = await getJSON(env, 'cards', {});
    const previous = cards[id] || {};

    const normalizeI18n = (source, prev) => {
      const result = { ...(prev || {}) };
      if (source && typeof source === 'object') {
        Object.keys(source).forEach(lang => {
          const value = source[lang];
          if (value !== undefined && value !== null) {
            result[lang] = String(value);
          }
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
  const logs = await getJSON(env, 'changelogs', DEFAULT_CHANGELOGS);
  return json(logs);
}

async function handleChangelogsPost(request, env) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: '未授权或登录已过期' }, 401);
  }

  const body = await request.json().catch(() => ({}));
  const version = String(body.version || '').trim();
  const items = Array.isArray(body.items)
    ? body.items.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!version || items.length === 0) {
    return json({ error: '参数不正确' }, 400);
  }

  const logs = await getJSON(env, 'changelogs', DEFAULT_CHANGELOGS);
  const newLog = { version, items };
  logs.unshift(newLog);

  await putJSON(env, 'changelogs', logs);
  return json({ success: true, log: newLog });
}

async function handleChangelogsPatch(request, env, path) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: '未授权或登录已过期' }, 401);
  }

  const version = decodeURIComponent(path.slice('changelogs/'.length));
  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items)
    ? body.items.map((item) => String(item).trim()).filter(Boolean)
    : [];

  if (!version || items.length === 0) {
    return json({ error: '更新内容不能为空' }, 400);
  }

  const logs = await getJSON(env, 'changelogs', DEFAULT_CHANGELOGS);
  const index = logs.findIndex((item) => String(item.version) === version);

  if (index < 0) {
    return json({ error: '更新日志不存在' }, 404);
  }

  logs[index].items = items;
  await putJSON(env, 'changelogs', logs);
  return json({ success: true, log: logs[index] });
}

/* ================= Bug ================= */

async function handleBugsGet(env) {
  const bugs = await getJSON(env, 'bugs', []);
  return json(bugs);
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
    resolved: false,
  };

  bugs.unshift(newBug);
  await putJSON(env, 'bugs', bugs);

  return json({ success: true, bug: newBug });
}

async function handleBugResolve(request, env, path) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: '未授权或登录已过期' }, 401);
  }

  const parts = path.split('/');
  const id = parts[1];
  if (!id) return json({ error: '缺少 Bug ID' }, 400);

  const bugs = await getJSON(env, 'bugs', []);
  const index = bugs.findIndex((bug) => String(bug.id) === String(id));

  if (index < 0) {
    return json({ error: 'Bug 未找到' }, 404);
  }

  bugs[index].resolved = true;
  await putJSON(env, 'bugs', bugs);

  return json({ success: true });
}

/* ================= 建议 ================= */

async function handleSuggestionsGet(env) {
  const suggestions = await getJSON(env, 'suggestions', []);
  return json(suggestions);
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
    status: 'pending',
  };

  suggestions.unshift(newSuggestion);
  await putJSON(env, 'suggestions', suggestions);

  return json({ success: true, suggestion: newSuggestion });
}

async function handleSuggestionStatus(request, env, path) {
  if (!(await requireAdmin(request, env))) {
    return json({ error: '未授权或登录已过期' }, 401);
  }

  const parts = path.split('/');
  const id = parts[1];
  const body = await request.json().catch(() => ({}));
  const status = body.status;

  if (!id || !['pending', 'accepted', 'rejected'].includes(status)) {
    return json({ error: '无效的状态值' }, 400);
  }

  const suggestions = await getJSON(env, 'suggestions', []);
  const index = suggestions.findIndex((item) => String(item.id) === String(id));

  if (index < 0) {
    return json({ error: '建议未找到' }, 404);
  }

  suggestions[index].status = status;
  await putJSON(env, 'suggestions', suggestions);

  return json({ success: true });
}

/* ================= 用户认证 ================= */

async function handleAuthRegister(request, env) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const displayName = String(body.displayName || username).trim() || username;

  if (!username || !password) {
    return json({ error: '用户名和密码不能为空' }, 400);
  }

  if (username.length < 3) {
    return json({ error: '用户名至少3个字符' }, 400);
  }

  if (password.length < 6) {
    return json({ error: '密码至少6个字符' }, 400);
  }

  if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
    return json({ error: '用户名包含非法字符' }, 400);
  }

  const exists = await env.NAV_KV.get(userNameKey(username));
  if (exists) {
    return json({ error: '用户名已被占用' }, 400);
  }

  const now = new Date().toISOString();
  const user = {
    id: randomId(),
    username,
    displayName,
    passwordHash: await hashPassword(password),
    avatar: '/api/uploads/default_avatar.png',
    background: '',
    bio: '这个人很懒，什么都没有写~',
    createdAt: now,
    lastActive: now,
  };

  await saveUser(env, user);

  const token = await createSessionToken(user.id, env);
  return json(
    { success: true, user: publicUser(user) },
    200,
    { 'Set-Cookie': sessionCookie(token, new URL(request.url)) }
  );
}

async function handleAuthLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!username || !password) {
    return json({ error: '用户名和密码不能为空' }, 400);
  }

  const user = await getUserByUsername(env, username);
  if (!user) {
    return json({ error: '用户名或密码错误' }, 401);
  }

  const inputHash = await hashPassword(password);
  if (inputHash !== user.passwordHash) {
    return json({ error: '用户名或密码错误' }, 401);
  }

  user.lastActive = new Date().toISOString();
  await env.NAV_KV.put(userKey(user.id), JSON.stringify(user));

  const token = await createSessionToken(user.id, env);
  return json(
    { success: true, user: publicUser(user) },
    200,
    { 'Set-Cookie': sessionCookie(token, new URL(request.url)) }
  );
}

async function handleAuthLogout(request, env) {
  return json(
    { success: true },
    200,
    { 'Set-Cookie': clearSessionCookie(new URL(request.url)) }
  );
}

async function handleAuthMe(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ error: '未登录' }, 401);
  }

  return json(publicUser(user));
}

/* ================= 用户资料 ================= */

async function handleUserProfileUpdate(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ error: '未登录' }, 401);
  }

  const body = await request.json().catch(() => ({}));

  if (body.displayName !== undefined) {
    user.displayName = String(body.displayName || '').trim() || user.username;
  }

  if (body.bio !== undefined) {
    user.bio = String(body.bio || '').trim();
  }

  user.lastActive = new Date().toISOString();
  await env.NAV_KV.put(userKey(user.id), JSON.stringify(user));

  return json({ success: true, user: publicUser(user) });
}

async function handleUserAvatarUpload(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ error: '未登录' }, 401);
  }

  const form = await request.formData();
  const file = form.get('avatar');

  if (!file || typeof file === 'string') {
    return json({ error: '请选择文件' }, 400);
  }

  const key = await saveUpload(env, file);
  user.avatar = `/api/uploads/${key}`;
  user.lastActive = new Date().toISOString();

  await env.NAV_KV.put(userKey(user.id), JSON.stringify(user));

  return json({ success: true, avatar: user.avatar, user: publicUser(user) });
}

async function handleUserBackgroundUpload(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return json({ error: '未登录' }, 401);
  }

  const form = await request.formData();
  const file = form.get('background');

  if (!file || typeof file === 'string') {
    return json({ error: '请选择文件' }, 400);
  }

  const key = await saveUpload(env, file);
  user.background = `/api/uploads/${key}`;
  user.lastActive = new Date().toISOString();

  await env.NAV_KV.put(userKey(user.id), JSON.stringify(user));

  return json({ success: true, background: user.background, user: publicUser(user) });
}

async function handleUserSearch(request, env, url) {
  const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return json([]);

  const list = await env.NAV_KV.list({ prefix: 'user:' });
  const results = [];

  for (const key of list.keys) {
    if (key.name.startsWith('user:name:')) continue;

    const user = await env.NAV_KV.get(key.name, { type: 'json' });
    if (!user) continue;

    const username = String(user.username || '').toLowerCase();
    const displayName = String(user.displayName || '').toLowerCase();

    if (username.includes(q) || displayName.includes(q)) {
      results.push(publicUser(user));
    }

    if (results.length >= 10) break;
  }

  return json(results);
}

async function handleUserGet(request, env, path) {
  const userId = decodeURIComponent(path.slice('users/'.length));
  const user = await getUserById(env, userId);

  if (!user) {
    return json({ error: '用户不存在' }, 404);
  }

  return json(publicUser(user));
}