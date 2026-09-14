// functions/download.js
// 资源下载中心页面

const DOWNLOAD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>资源下载中心</title>
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
    --success-color: #10b981;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  body {
    background-color: var(--bg-color);
    background-image:
      radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
      radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.1) 0px, transparent 50%);
    min-height: 100vh;
    color: var(--text-main);
    padding: 40px 24px;
  }
  .container { max-width: 900px; margin: 0 auto; }
  .header-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .back-btn { color: var(--text-sub); text-decoration: none; font-size: 0.9rem; }
  .back-btn:hover { color: var(--accent-hover); }
  .header-title { text-align: center; margin-bottom: 32px; }
  .header-title h1 {
    font-size: 2rem; font-weight: 700;
    background: linear-gradient(to right, #f8fafc, #94a3b8);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
  }
  .header-title p { color: var(--text-sub); font-size: 0.95rem; }
  .admin-bar {
    display: flex; justify-content: space-between; align-items: center; gap: 10px;
    background: var(--card-bg); padding: 12px 20px; border-radius: 12px;
    border: 1px solid var(--card-border); margin-bottom: 20px;
  }
  .admin-bar .status { font-size: 0.85rem; color: var(--text-sub); }
  .btn {
    background: var(--accent-color); color: #fff; border: none;
    padding: 8px 16px; border-radius: 8px; cursor: pointer;
    font-size: 0.85rem; transition: background 0.2s;
    text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
  }
  .btn:hover { background: var(--accent-hover); }
  .btn-secondary { background: rgba(255,255,255,0.1); color: var(--text-main); }
  .btn-secondary:hover { background: rgba(255,255,255,0.2); }
  .btn-danger { background: var(--danger-color); }
  .btn-danger:hover { background: #dc2626; }
  .file-list { display: flex; flex-direction: column; gap: 12px; }
  .file-card {
    background: var(--card-bg); border: 1px solid var(--card-border);
    border-radius: 12px; padding: 16px 20px;
    display: flex; align-items: center; gap: 16px;
    transition: border-color 0.2s;
  }
  .file-card:hover { border-color: rgba(99, 102, 241, 0.4); }
  .file-icon {
    width: 44px; height: 44px; border-radius: 10px;
    background: rgba(255,255,255,0.05);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-size: 1.3rem;
  }
  .file-info { flex: 1; min-width: 0; }
  .file-name {
    font-weight: 600; font-size: 0.95rem; margin-bottom: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .file-meta { font-size: 0.75rem; color: var(--text-sub); }
  .file-actions { display: flex; gap: 6px; flex-shrink: 0; }
  .empty {
    text-align: center; color: var(--text-sub); padding: 60px 20px;
    background: var(--card-bg); border-radius: 12px; border: 1px solid var(--card-border);
  }
  .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center;
    z-index: 100; opacity: 0; visibility: hidden; transition: all 0.22s; }
  .modal.is-open { opacity: 1; visibility: visible; }
  .modal-content {
    background: #1e293b; border: 1px solid var(--card-border);
    padding: 24px; border-radius: 16px; width: 90%; max-width: 420px;
  }
  .modal-content h3 { margin-bottom: 16px; }
  input[type=file] {
    width: 100%; padding: 10px; background: #0f172a;
    border: 1px dashed var(--card-border); border-radius: 8px;
    color: #fff; cursor: pointer;
  }
  .progress {
    margin-top: 12px; height: 6px; background: #334155;
    border-radius: 4px; overflow: hidden;
  }
  .progress-fill { height: 100%; width: 0; background: var(--success-color); transition: width 0.2s; }
</style>
</head>
<body>
  <div class="container">
    <div class="header-nav">
      <a href="/" class="back-btn">&larr; 返回导航页</a>
    </div>
    <header class="header-title">
      <h1>资源下载中心</h1>
      <p>下载整合包、客户端和服务器资源</p>
    </header>

    <div class="admin-bar">
      <span class="status" id="statusText">加载中...</span>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-secondary" id="adminBtn" onclick="toggleAdmin()">管理员登录</button>
        <button class="btn" id="uploadBtn" style="display:none;" onclick="openUpload()">上传文件</button>
      </div>
    </div>

    <div class="file-list" id="fileList"></div>
  </div>

  <div class="modal" id="uploadModal">
    <div class="modal-content">
      <h3>上传文件</h3>
      <input type="file" id="uploadInput" multiple>
      <div class="progress" id="progressBar" style="display:none;">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
        <button class="btn btn-secondary" onclick="closeUpload()">取消</button>
        <button class="btn" onclick="submitUpload()">开始上传</button>
      </div>
    </div>
  </div>

  <script>
    let isAdmin = false;
    let adminToken = sessionStorage.getItem('admin_token') || '';
    let files = [];

    function formatSize(bytes) {
      if (!bytes) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
      return (bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + units[i];
    }

    function fileIcon(name) {
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (['zip','rar','7z','tar','gz'].includes(ext)) return '&#128230;';
      if (['png','jpg','jpeg','webp','gif','svg'].includes(ext)) return '&#128444;&#65039;';
      if (['mp4','webm','mov','avi','mkv'].includes(ext)) return '&#127916;';
      if (['mp3','wav','ogg','flac','m4a'].includes(ext)) return '&#127925;';
      if (['pdf','doc','docx','xls','xlsx','txt'].includes(ext)) return '&#128196;';
      return '&#128194;';
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    }

    async function loadFiles() {
      try {
        const res = await fetch('/api/download/list');
        const data = await res.json();
        files = data.files || [];
        renderFiles();
      } catch (err) {
        document.getElementById('fileList').innerHTML = '<div class="empty">加载失败</div>';
      }
    }

    function renderFiles() {
      const list = document.getElementById('fileList');
      if (!files.length) {
        list.innerHTML = '<div class="empty">暂无资源文件</div>';
        return;
      }
      list.innerHTML = files.map(f => \`
        <div class="file-card">
          <div class="file-icon">\${fileIcon(f.name)}</div>
          <div class="file-info">
            <div class="file-name">\${escapeHtml(f.name)}</div>
            <div class="file-meta">\${formatSize(f.size)} · \${new Date(f.uploaded).toLocaleString('zh-CN')}</div>
          </div>
          <div class="file-actions">
            <a class="btn" href="/api/uploads/\${f.key.split('/').map(encodeURIComponent).join('/')}?download=1" download>下载</a>
            \${isAdmin ? \`<button class="btn btn-danger" onclick="deleteFile('\${escapeHtml(f.key)}')">删除</button>\` : ''}
          </div>
        </div>
      \`).join('');
    }

    function updateUI() {
      document.getElementById('statusText').textContent = isAdmin ? '当前模式：管理员' : '当前模式：访客';
      document.getElementById('adminBtn').textContent = isAdmin ? '退出管理员' : '管理员登录';
      document.getElementById('uploadBtn').style.display = isAdmin ? 'inline-flex' : 'none';
    }

    async function toggleAdmin() {
      if (isAdmin) {
        if (confirm('确定退出管理员吗？')) {
          isAdmin = false;
          adminToken = '';
          sessionStorage.removeItem('admin_token');
          updateUI();
          renderFiles();
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
        const data = await res.json();
        if (data.success) {
          isAdmin = true;
          adminToken = data.token;
          sessionStorage.setItem('admin_token', adminToken);
          updateUI();
          renderFiles();
          alert('管理员登录成功');
        } else {
          alert(data.error || '密码错误');
        }
      } catch (err) {
        alert('登录失败');
      }
    }

    function openUpload() {
      document.getElementById('uploadModal').classList.add('is-open');
      document.getElementById('uploadInput').value = '';
      document.getElementById('progressBar').style.display = 'none';
      document.getElementById('progressFill').style.width = '0';
    }

    function closeUpload() {
      document.getElementById('uploadModal').classList.remove('is-open');
    }

    function submitUpload() {
      const input = document.getElementById('uploadInput');
      const selected = Array.from(input.files || []);
      if (!selected.length) return alert('请选择文件');

      const formData = new FormData();
      selected.forEach(f => formData.append('files', f));

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/download/upload');
      xhr.setRequestHeader('Authorization', 'Bearer ' + adminToken);
      document.getElementById('progressBar').style.display = 'block';

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round(e.loaded / e.total * 100);
          document.getElementById('progressFill').style.width = pct + '%';
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          closeUpload();
          loadFiles();
          alert('上传成功');
        } else {
          let msg = '上传失败';
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch(_){}
          alert(msg);
        }
      };
      xhr.onerror = () => alert('网络错误');
      xhr.send(formData);
    }

    async function deleteFile(key) {
      if (!confirm('确定删除该文件吗？')) return;
      try {
        const res = await fetch('/api/download/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + adminToken
          },
          body: JSON.stringify({ key })
        });
        const data = await res.json();
        if (data.success) {
          loadFiles();
        } else {
          alert(data.error || '删除失败');
        }
      } catch (err) {
        alert('删除失败');
      }
    }

    if (adminToken) isAdmin = true;
    updateUI();
    loadFiles();
  </script>
</body>
</html>`;

export async function onRequest(context) {
  return new Response(DOWNLOAD_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}