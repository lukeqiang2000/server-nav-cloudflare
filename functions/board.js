// functions/board.js
// 处理 /board 路径，返回公告页

const BOARD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>服务器公告中心</title>
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
      --danger-color: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body {
      background-color: var(--bg-color);
      background-image:
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 40px 24px;
      color: var(--text-main);
    }
    .container { width: 100%; max-width: 800px; }
    .header-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .back-btn { color: var(--text-sub); text-decoration: none; font-size: 0.9rem; }
    .back-btn:hover { color: var(--accent-hover); }
    .header-title { margin-bottom: 32px; text-align: center; }
    .header-title h1 {
      font-size: 2rem; font-weight: 700;
      background: linear-gradient(to right, #f8fafc, #94a3b8);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header-title p { color: var(--text-sub); font-size: 0.95rem; }
    .admin-bar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 20px; background: var(--card-bg); padding: 12px 20px;
      border-radius: 12px; border: 1px solid var(--card-border);
    }
    .notice-list { display: flex; flex-direction: column; gap: 20px; }
    .notice-card {
      background: var(--card-bg); backdrop-filter: blur(12px);
      border: 1px solid var(--card-border); border-radius: 16px; padding: 24px;
    }
    .notice-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;
    }
    .notice-title-text { font-size: 1.15rem; font-weight: 600; color: #fff; }
    .notice-date { font-size: 0.8rem; color: var(--text-sub); }
    .notice-content {
      font-size: 0.95rem; line-height: 1.6; color: #cbd5e1;
      white-space: pre-wrap; margin-bottom: 12px;
    }
    .notice-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; }
    .btn {
      background: var(--accent-color); color: white; border: none;
      padding: 8px 16px; border-radius: 8px; cursor: pointer;
      font-size: 0.85rem; transition: background 0.2s;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn-secondary { background: rgba(255,255,255,0.1); color: var(--text-main); }
    .btn-secondary:hover { background: rgba(255,255,255,0.2); }
    .btn-danger { background: var(--danger-color); }
    .btn-danger:hover { background: #dc2626; }
    .modal {
      display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
      justify-content: center; align-items: center; z-index: 100;
      opacity: 0; visibility: hidden; transition: all 0.22s ease;
    }
    .modal.is-open { opacity: 1; visibility: visible; }
    .modal-content {
      background: #1e293b; border: 1px solid var(--card-border);
      padding: 24px; border-radius: 16px; width: 90%; max-width: 500px;
    }
    .modal-content h3 { margin-bottom: 16px; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; font-size: 0.85rem; color: var(--text-sub); margin-bottom: 6px; }
    .form-control {
      width: 100%; padding: 10px; background: #0f172a;
      border: 1px solid var(--card-border); border-radius: 8px;
      color: white; outline: none;
    }
    .form-control:focus { border-color: var(--accent-color); }
    textarea.form-control { resize: vertical; min-height: 120px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-nav">
      <a href="/" class="back-btn">← 返回导航页</a>
    </div>
    <header class="header-title">
      <h1>服务器公告中心</h1>
      <p>发布与查阅服务器的最新活动与维护通知</p>
    </header>
    <main>
      <div class="admin-bar">
        <span id="adminStatus" style="font-size: 0.9rem; color: var(--text-sub);">当前模式：访客模式</span>
        <div>
          <button class="btn btn-secondary" id="adminBtn" onclick="toggleAdmin()">管理员登录</button>
          <button class="btn" id="addNoticeBtn" style="display:none; margin-left: 8px;" onclick="openModal()">+ 发布公告</button>
        </div>
      </div>
      <div class="notice-list" id="noticeContainer"></div>
    </main>
  </div>

  <div class="modal" id="noticeModal">
    <div class="modal-content">
      <h3 id="modalTitle">发布新公告</h3>
      <input type="hidden" id="editIndex">
      <div class="form-group">
        <label>公告标题</label>
        <input type="text" id="noticeTitleInput" class="form-control" placeholder="请输入标题...">
      </div>
      <div class="form-group">
        <label>公告内容</label>
        <textarea id="noticeContentInput" class="form-control" placeholder="支持换行..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn btn-danger" onclick="closeModal()">取消</button>
        <button class="btn" onclick="saveNotice()">保存发布</button>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = '/api/notices';
    let isAdmin = false;
    let adminToken = sessionStorage.getItem('admin_token') || '';
    let noticesCache = [];

    async function getNotices() {
      try {
        const res = await fetch(API_BASE);
        const json = await res.json();
        return json.success ? json.data : [];
      } catch (err) {
        return [];
      }
    }

    async function saveNoticesData(notices) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + adminToken
          },
          body: JSON.stringify({ notices })
        });
        const json = await res.json();
        if (json.success) {
          await renderNotices();
        } else {
          alert('保存失败：' + (json.message || json.error || '未知错误'));
        }
      } catch (err) {
        alert('请求失败，无法同步到服务器！');
      }
    }

    async function toggleAdmin() {
      if (isAdmin) {
        if (confirm('确定退出管理员身份吗？')) {
          isAdmin = false;
          adminToken = '';
          sessionStorage.removeItem('admin_token');
          updateAdminUI();
        }
        return;
      }
      const pwd = prompt('请输入管理员密码：');
      if (!pwd) return;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pwd })
        });
        const json = await res.json();
        if (json.success) {
          isAdmin = true;
          adminToken = json.token;
          sessionStorage.setItem('admin_token', adminToken);
          alert('验证成功！已开启管理权限。');
          updateAdminUI();
        } else {
          alert(json.error || '密码错误！');
        }
      } catch (err) {
        alert('登录请求失败！');
      }
    }

    function updateAdminUI() {
      document.getElementById('adminStatus').innerText = isAdmin ? '当前模式：管理员' : '当前模式：访客模式';
      document.getElementById('adminBtn').innerText = isAdmin ? '退出登录' : '管理员登录';
      document.getElementById('addNoticeBtn').style.display = isAdmin ? 'inline-block' : 'none';
      renderNotices();
    }

    async function renderNotices() {
      const container = document.getElementById('noticeContainer');
      container.innerHTML = '<div class="notice-card" style="text-align:center;color:var(--text-sub);">正在加载公告...</div>';
      const notices = await getNotices();
      noticesCache = notices;
      container.innerHTML = '';

      if (notices.length === 0) {
        container.innerHTML = '<div class="notice-card" style="text-align:center;color:var(--text-sub);">暂无任何公告</div>';
        return;
      }

      notices.forEach((notice, index) => {
        const card = document.createElement('div');
        card.className = 'notice-card';
        let adminActions = isAdmin ? (
          '<div class="notice-actions">' +
          '<button class="btn btn-secondary" onclick="openModal(' + index + ')">编辑</button>' +
          '<button class="btn btn-danger" onclick="deleteNotice(' + index + ')">删除</button>' +
          '</div>'
        ) : '';
        card.innerHTML =
          '<div class="notice-header">' +
            '<span class="notice-title-text">' + escapeHtml(notice.title) + '</span>' +
            '<span class="notice-date">' + escapeHtml(notice.date || '') + '</span>' +
          '</div>' +
          '<div class="notice-content">' + escapeHtml(notice.content) + '</div>' +
          adminActions;
        container.appendChild(card);
      });
    }

    function escapeHtml(text) {
      return String(text || '').replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
      });
    }

    function openModal(index) {
      if (!isAdmin) return;
      if (index === undefined) index = -1;
      document.getElementById('editIndex').value = index;
      if (index >= 0 && noticesCache[index]) {
        const notice = noticesCache[index];
        document.getElementById('modalTitle').innerText = '编辑公告';
        document.getElementById('noticeTitleInput').value = notice.title || '';
        document.getElementById('noticeContentInput').value = notice.content || '';
      } else {
        document.getElementById('modalTitle').innerText = '发布新公告';
        document.getElementById('noticeTitleInput').value = '';
        document.getElementById('noticeContentInput').value = '';
      }
      document.getElementById('noticeModal').classList.add('is-open');
    }

    function closeModal() {
      document.getElementById('noticeModal').classList.remove('is-open');
    }

    async function saveNotice() {
      if (!isAdmin) return;
      const title = document.getElementById('noticeTitleInput').value.trim();
      const content = document.getElementById('noticeContentInput').value.trim();
      const index = parseInt(document.getElementById('editIndex').value);

      if (!title || !content) {
        alert('标题和内容不能为空！');
        return;
      }

      const notices = await getNotices();
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dateStr = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

      if (index >= 0) {
        notices[index].title = title;
        notices[index].content = content;
      } else {
        notices.unshift({ title, content, date: dateStr, img: '' });
      }

      await saveNoticesData(notices);
      closeModal();
    }

    async function deleteNotice(index) {
      if (!isAdmin) return;
      if (!confirm('确定删除此公告？')) return;
      const notices = await getNotices();
      notices.splice(index, 1);
      saveNoticesData(notices);
    }

    if (adminToken) {
      isAdmin = true;
    }
    updateAdminUI();
  </script>
</body>
</html>`;

export async function onRequest(context) {
  return new Response(BOARD_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}