const escapeHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const DOWNLOAD_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>资源下载中心</title>
  <style>
    :root{color-scheme:dark;--bg:#0f172a;--card:#1e293b;--line:#334155;--text:#f8fafc;--sub:#94a3b8;--accent:#6366f1;--danger:#ef4444}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px system-ui,sans-serif}
    header,main{max-width:1200px;margin:auto}header{padding:18px 20px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);flex-wrap:wrap}
    h1{font-size:20px;margin:0 auto 0 0}.toolbar{display:flex;gap:8px;flex-wrap:wrap}
    button{border:0;border-radius:7px;padding:8px 12px;background:var(--accent);color:white;cursor:pointer}button.secondary{background:#334155}button.danger{background:var(--danger)}
    button:disabled{opacity:.5;cursor:not-allowed}.user{color:var(--sub);padding:8px}.crumb{padding:18px 20px;color:var(--sub)}.crumb a{color:#a5b4fc}
    .grid{padding:0 20px 30px;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px;min-height:76px;display:flex;gap:10px;align-items:center}
    .card input{width:18px;height:18px}.info{min-width:0;flex:1}.name{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.meta{color:var(--sub);font-size:12px;margin-top:5px}.actions{display:flex;gap:5px}.actions button{padding:5px 7px;font-size:12px}
    dialog{border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--text);padding:20px;min-width:min(380px,calc(100vw - 30px))}dialog::backdrop{background:#0008}input[type=text],input[type=password],input[type=file]{width:100%;padding:9px;margin:8px 0;background:#0f172a;color:var(--text);border:1px solid var(--line);border-radius:6px}
  </style>
</head>
<body>
<header><h1>资源下载中心</h1><span id="user" class="user">检查登录状态...</span><div class="toolbar">
  <button id="admin" class="secondary">管理员</button><button id="upload" hidden>上传</button><button id="folder" hidden>新建文件夹</button><button id="refresh" class="secondary">刷新</button>
</div></header>
<main><div id="crumb" class="crumb"></div><div id="grid" class="grid"></div></main>
<dialog id="prompt"><form method="dialog"><h3 id="promptTitle"></h3><input id="promptInput" type="text"><menu><button value="cancel" class="secondary">取消</button><button value="ok">确定</button></menu></form></dialog>
<input id="files" type="file" multiple hidden>
<script>
const path=decodeURIComponent(location.pathname.replace(/^\\/download\\/?/,'').replace(/\\/$/,''));
const $=id=>document.getElementById(id), api=(url,options={})=>fetch(url,{credentials:'include',...options});
const safeName=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let admin=false, files=[], folders=[];
function formatSize(n){if(!n)return '0 B';const units=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<3){n/=1024;i++}return n.toFixed(i?1:0)+' '+units[i]}
function ask(title,value=''){return new Promise(resolve=>{const d=$('prompt'),input=$('promptInput');$('promptTitle').textContent=title;input.value=value;d.returnValue='';d.showModal();d.addEventListener('close',()=>resolve(d.returnValue==='ok'?input.value.trim():null),{once:true})})}
function applyAdmin(){ $('upload').hidden=!admin; $('folder').hidden=!admin; $('admin').textContent=admin?'退出管理员':'管理员'; }
async function syncAdmin(){const r=await api('/api/admin/me');admin=r.ok&&(await r.json()).authenticated;applyAdmin()}
function render(){ $('crumb').innerHTML='<a href="/download/">主目录</a>'+(path?' / '+path.split('/').map(safeName).join(' / '):'');const folderCards=folders.map(key=>{const name=key.split('/').pop();const href='/download/'+key.split('/').map(encodeURIComponent).join('/');return '<article class="card"><div class="info" onclick="location.href='+JSON.stringify(href)+'" style="cursor:pointer"><div class="name">📁 '+safeName(name)+'</div><div class="meta">云端文件夹</div></div>'+(admin?'<div class="actions"><button class="secondary" onclick="renameFolder('+JSON.stringify(key)+','+JSON.stringify(name)+')">改名</button><button class="danger" onclick="deleteFolder('+JSON.stringify(key)+')">删除</button></div>':'')+'</article>'}).join('');const fileCards=files.map(file=>'<article class="card"><input type="checkbox" data-key="'+encodeURIComponent(file.key)+'"><div class="info"><div class="name">📄 '+safeName(file.name)+'</div><div class="meta">'+formatSize(file.size)+'</div></div><div class="actions"><a href="/api/files/'+encodeURIComponent(file.key)+'?download=1" download><button class="secondary">下载</button></a>'+(admin?'<button onclick="renameFile('+JSON.stringify(file.key)+','+JSON.stringify(file.name)+')">改名</button><button class="danger" onclick="deleteFile('+JSON.stringify(file.key)+')">删除</button>':'')+'</div></article>').join('');$('grid').innerHTML=folderCards+fileCards||'<p>当前目录为空</p>'}
async function load(){const r=await api('/api/download/list?path='+encodeURIComponent(path));if(!r.ok){$('grid').innerHTML='<p>无法读取云端资源</p>';return}const data=await r.json();files=data.files||[];folders=data.folders||[];render();const me=await api('/api/auth/me');$('user').textContent=me.ok?((await me.json()).displayName||'已登录'):'未登录'}
async function renameFile(key,name){const value=await ask('修改文件名',name);if(!value||value===name)return;const r=await api('/api/file/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,newName:value})});if(!r.ok)alert((await r.json()).error||'重命名失败');else load()}
async function deleteFile(key){if(!confirm('确定删除此文件吗？'))return;const r=await api('/api/file/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});if(!r.ok)alert((await r.json()).error||'删除失败');else load()}
async function renameFolder(key,name){const value=await ask('修改文件夹名称',name);if(!value||value===name)return;const r=await api('/api/folder/rename',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folderKey:key,newName:value})});if(!r.ok)alert((await r.json()).error||'重命名失败');else location.reload()}
async function deleteFolder(key){if(!confirm('确定删除此文件夹及其内容吗？'))return;const r=await api('/api/folder/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folderKey:key})});if(!r.ok)alert((await r.json()).error||'删除失败');else load()}
$('admin').onclick=async()=>{if(admin){document.cookie='admin_token=; Max-Age=0; Path=/';sessionStorage.removeItem('isAdmin');admin=false;applyAdmin();return}const password=await ask('请输入管理员密码');if(!password)return;const r=await api('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});if(!r.ok)alert((await r.json()).error||'登录失败');else{admin=true;applyAdmin()}}
$('folder').onclick=async()=>{const name=await ask('新建文件夹');if(!name)return;const r=await api('/api/folder/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({relPath:path,folderName:name})});if(!r.ok)alert((await r.json()).error||'创建失败');else load()}
$('upload').onclick=()=>$('files').click();$('files').onchange=async()=>{const data=new FormData();data.append('relPath',path);for(const file of $('files').files)data.append('files',file);const r=await api('/api/file/upload',{method:'POST',body:data});if(!r.ok)alert((await r.json()).error||'上传失败');else{ $('files').value='';load() }};$('refresh').onclick=load;
syncAdmin().then(load);
</script></body></html>`;

export async function onRequest() {
  return new Response(DOWNLOAD_HTML, {headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'}});
}
