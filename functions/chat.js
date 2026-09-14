// functions/chat.js
// 在线聊天室页面（轮询版）

const CHAT_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>在线聊天室</title>
<link rel="icon" href="/resource/grassblock.webp" type="image/webp">
<style>
  :root {
    --bg-color: #0f172a;
    --card-bg: rgba(30, 41, 59, 0.7);
    --card-border: rgba(255, 255, 255, 0.08);
    --text-main: #f8fafc;
    --text-sub: #94a3b8;
    --accent-color: #6366f1;
    --accent-hover: #818cf8;
    --success-color: #10b981;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  html, body { height: 100%; }
  body {
    background-color: var(--bg-color);
    color: var(--text-main);
    display: flex; flex-direction: column;
    height: 100vh; overflow: hidden;
  }
  .header {
    padding: 12px 20px; background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid var(--card-border);
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .header-left { display: flex; align-items: center; gap: 14px; }
  .back-btn { color: var(--text-sub); text-decoration: none; font-size: 0.9rem; }
  .back-btn:hover { color: var(--accent-hover); }
  .header-title { font-weight: 600; font-size: 1rem; }
  .user-info { font-size: 0.8rem; color: var(--text-sub); }
  .messages {
    flex: 1; overflow-y: auto; padding: 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  .msg {
    display: flex; gap: 10px; align-items: flex-start;
    max-width: 80%;
  }
  .msg.self { align-self: flex-end; flex-direction: row-reverse; }
  .msg-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    flex-shrink: 0; object-fit: cover;
    background: #1e293b;
  }
  .msg-body {
    background: rgba(255, 255, 255, 0.08);
    padding: 10px 14px; border-radius: 14px;
    word-break: break-word; font-size: 0.9rem;
    line-height: 1.4;
  }
  .msg.self .msg-body {
    background: var(--accent-color); color: #fff;
  }
  .msg-meta {
    font-size: 0.7rem; color: var(--text-sub);
    margin-bottom: 4px;
  }
  .msg.self .msg-meta { text-align: right; }
  .msg-name { font-weight: 600; color: var(--text-main); }
  .msg.self .msg-name { color: rgba(255,255,255,0.9); }
  .input-area {
    padding: 12px 20px; background: rgba(15, 23, 42, 0.9);
    border-top: 1px solid var(--card-border);
    display: flex; gap: 10px; flex-shrink: 0;
  }
  .input-area input {
    flex: 1; padding: 10px 16px; background: rgba(255,255,255,0.06);
    border: 1px solid var(--card-border); border-radius: 20px;
    color: var(--text-main); font-size: 0.9rem; outline: none;
  }
  .input-area input:focus { background: rgba(255,255,255,0.1); }
  .send-btn {
    background: var(--accent-color); color: #fff;
    border: none; padding: 0 20px; border-radius: 20px;
    cursor: pointer; font-size: 0.9rem; font-weight: 600;
    transition: background 0.2s;
  }
  .send-btn:hover { background: var(--accent-hover); }
  .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .auth-overlay {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95);
    display: flex; align-items: center; justify-content: center;
    z-index: 100;
  }
  .auth-box {
    text-align: center; padding: 40px; background: var(--card-bg);
    border-radius: 16px; border: 1px solid var(--card-border);
  }
  .auth-box h2 { margin-bottom: 16px; }
  .auth-box p { color: var(--text-sub); margin-bottom: 20px; font-size: 0.9rem; }
  .status-dot {
    display: inline-block; width: 8px; height: 8px;
    border-radius: 50%; background: var(--success-color);
    margin-right: 6px; animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
</style>
</head>
<body>
  <header class="header">
    <div class="header-left">
      <a href="/" class="back-btn">&larr; 返回</a>
      <span class="header-title">在线聊天室</span>
      <span class="user-info" id="statusText">连接中...</span>
    </div>
    <div class="user-info" id="userInfo"></div>
  </header>

  <div class="messages" id="messages"></div>

  <div class="input-area">
    <input type="text" id="msgInput" placeholder="输入消息..." disabled maxlength="500">
    <button class="send-btn" id="sendBtn" disabled>发送</button>
  </div>

  <div class="auth-overlay" id="authOverlay" style="display:none;">
    <div class="auth-box">
      <h2>需要登录</h2>
      <p>请先返回导航页登录账号后再使用聊天室</p>
      <a href="/" class="send-btn" style="display:inline-block; padding:10px 30px; text-decoration:none;">返回首页</a>
    </div>
  </div>

  <script>
    let currentUser = null;
    let lastTimestamp = 0;
    let polling = null;
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('msgInput');
    const sendBtn = document.getElementById('sendBtn');
    const statusText = document.getElementById('statusText');
    const userInfo = document.getElementById('userInfo');
    const authOverlay = document.getElementById('authOverlay');

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    async function checkUser() {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          currentUser = await res.json();
          userInfo.textContent = '已登录：' + (currentUser.displayName || currentUser.username);
          inputEl.disabled = false;
          sendBtn.disabled = false;
          return true;
        }
      } catch (err) {}
      authOverlay.style.display = 'flex';
      return false;
    }

    function renderMessage(msg) {
      const isSelf = currentUser && msg.userId === currentUser.id;
      const div = document.createElement('div');
      div.className = 'msg' + (isSelf ? ' self' : '');
      div.innerHTML = \`
        <img class="msg-avatar" src="\${escapeHtml(msg.avatar || '/api/uploads/default_avatar.png')}" onerror="this.src='/api/uploads/default_avatar.png'">
        <div>
          <div class="msg-meta">
            <span class="msg-name">\${escapeHtml(msg.username)}</span>
            · \${new Date(msg.timestamp).toLocaleTimeString('zh-CN')}
          </div>
          <div class="msg-body">\${escapeHtml(msg.text)}</div>
        </div>
      \`;
      messagesEl.appendChild(div);
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function loadMessages(initial = false) {
      try {
        const url = '/api/chat/messages' + (initial ? '' : '?since=' + lastTimestamp);
        const res = await fetch(url);
        const data = await res.json();
        if (data.messages && data.messages.length) {
          if (initial) messagesEl.innerHTML = '';
          data.messages.forEach(m => {
            renderMessage(m);
            if (m.timestamp > lastTimestamp) lastTimestamp = m.timestamp;
          });
          scrollToBottom();
        }
        statusText.innerHTML = '<span class="status-dot"></span>已连接';
      } catch (err) {
        statusText.textContent = '连接失败，重试中...';
      }
    }

    async function sendMessage() {
      const text = inputEl.value.trim();
      if (!text) return;
      sendBtn.disabled = true;
      try {
        const res = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          inputEl.value = '';
          await loadMessages();
        } else {
          const data = await res.json().catch(() => ({}));
          alert(data.error || '发送失败');
        }
      } catch (err) {
        alert('网络错误');
      } finally {
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    sendBtn.onclick = sendMessage;
    inputEl.onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };

    async function init() {
      if (!await checkUser()) return;
      await loadMessages(true);
      polling = setInterval(() => loadMessages(false), 3000);
    }

    init();
  </script>
</body>
</html>`;

export async function onRequest(context) {
  return new Response(CHAT_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}