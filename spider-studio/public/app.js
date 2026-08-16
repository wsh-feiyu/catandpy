/**
 * TVBox Spider Studio - 前端主逻辑
 */
'use strict';

// ============ 工具 ============
async function api(url, opts) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '请求失败');
  return data;
}
const post = (url, body) =>
  api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ============ 全局状态 ============
let editor = null;
let currentFile = null; // { name, type }
let dirty = false;

const JS_METHODS = ['init', 'home', 'homeVod', 'category', 'detail', 'play', 'search'];
const PY_METHODS = ['init', 'homeContent', 'homeVideoContent', 'categoryContent', 'detailContent', 'searchContent', 'playerContent'];

// JS: 位置参数数组
const JS_FAST = {
  init: {},
  home: [true],
  homeVod: [],
  category: ['电影', '1', true, {}],
  detail: ['1'],
  play: ['在线播放', '1$1$0', []],
  search: ['猫', false, '1'],
};
// PY: 关键字参数字典
const PY_FAST = {
  init: {},
  homeContent: {},
  homeVideoContent: {},
  categoryContent: { tid: '电影', pg: '1', filter: true, ext: {} },
  detailContent: { ids: ['1'] },
  searchContent: { key: '猫', quick: false, pg: '1' },
  playerContent: { flag: '', id: '', vipflags: [] },
};

// ============ 文件列表 ============
async function loadFiles() {
  try {
    const data = await api('/api/files');
    const ul = $('file-list');
    ul.innerHTML = '';
    const render = (list, tag, cls) => {
      list.forEach((f) => {
        const li = el('li');
        if (currentFile && currentFile.name === f.name) li.classList.add('active');
        li.appendChild(el('span', 'tag ' + cls, tag));
        li.appendChild(el('span', 'nm', f.name));
        li.title = f.name;
        li.addEventListener('click', () => openFile(f.name));
        // 右键删除/重命名
        li.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          fileCtxMenu(f.name, ev.clientX, ev.clientY);
        });
        ul.appendChild(li);
      });
    };
    render(data.files.filter((f) => f.type === 'js'), 'JS', 'js');
    render(data.files.filter((f) => f.type === 'py'), 'PY', 'py');
    if (!data.files.length) {
      ul.appendChild(el('div', 'f-header', '暂无源文件，点右上角「新建源」'));
    }
  } catch (e) {
    $('file-list').innerHTML = '<div class="f-header">加载失败: ' + e.message + '</div>';
  }
}

function fileCtxMenu(name, x, y) {
  const menu = document.createElement('div');
  menu.style.cssText =
    'position:fixed;left:' + x + 'px;top:' + y + 'px;z-index:99;background:#2d2d30;border:1px solid #3c3c3c;border-radius:4px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,.4);';
  const mk = (txt, fn) => {
    const d = el('div', '', txt);
    d.style.cssText = 'padding:6px 16px;cursor:pointer;font-size:12px;';
    d.onmouseover = () => (d.style.background = '#0e639c');
    d.onmouseout = () => (d.style.background = '');
    d.onclick = () => {
      menu.remove();
      fn();
    };
    menu.appendChild(d);
  };
  mk('删除', async () => {
    if (!confirm('确定删除 ' + name + ' ？')) return;
    await post('/api/file/delete', { path: name });
    if (currentFile && currentFile.name === name) closeFile();
    loadFiles();
  });
  document.body.appendChild(menu);
  document.addEventListener(
    'click',
    () => menu.remove(),
    { once: true }
  );
}

function closeFile() {
  currentFile = null;
  dirty = false;
  $('cur-name').textContent = '未打开文件';
  $('dirty-mark').textContent = '';
  if (editor) editor.setValue('// 选择左侧文件开始编辑\n');
}

// ============ 编辑器 ============
async function openFile(name) {
  try {
    const data = await api('/api/file?path=' + encodeURIComponent(name));
    const type = name.toLowerCase().endsWith('.js') ? 'js' : 'py';
    currentFile = { name, type };
    dirty = false;
    $('cur-name').textContent = name;
    $('dirty-mark').textContent = '';
    if (!editor) return;
    const model = monaco.editor.createModel(data.content, type === 'js' ? 'javascript' : 'python');
    editor.setModel(model);
    setupDebug(type);
    highlightActive();
    loadExt(name); // 打开源时自动加载该源保存过的 ext
    // 打开新源文件时重置模拟器，下次切到「模拟器」tab 自动按新文件重新加载
    if (typeof simReset === 'function') simReset();
    // 窄屏下打开文件后自动切到编辑器视图
    if (window.innerWidth <= 820) mobileShowArea('editor-area');
  } catch (e) {
    alert('打开失败: ' + e.message);
  }
}

function highlightActive() {
  document.querySelectorAll('#file-list li').forEach((li) => {
    const nm = li.querySelector('.nm');
    li.classList.toggle('active', nm && nm.textContent === currentFile.name);
  });
}

async function saveFile() {
  if (!currentFile) return;
  try {
    await post('/api/file', { path: currentFile.name, content: editor.getValue() });
    dirty = false;
    $('dirty-mark').textContent = '';
    loadFiles();
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}

// ============ 调试面板 ============
// ============ ext 键值对编辑 ============
// 每个源的 ext 键值不同，用动态"key + value"行编辑，自动拼成 JSON 字符串传给后端。
// value 输入的内容若是合法 JSON 字面量（数字/布尔/对象/数组/null）则按原类型生成，否则作为字符串。

// 添加一行键值对
function addExtRow(key, value) {
  const wrap = document.createElement('div');
  wrap.className = 'ext-row';
  const k = document.createElement('input');
  k.className = 'ext-key';
  k.placeholder = 'key';
  k.value = key == null ? '' : String(key);
  const v = document.createElement('input');
  v.className = 'ext-val';
  v.placeholder = 'value';
  v.value = value == null ? '' : String(value);
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'ext-del';
  del.title = '删除';
  del.textContent = '×';
  del.addEventListener('click', () => wrap.remove());
  wrap.appendChild(k);
  wrap.appendChild(v);
  wrap.appendChild(del);
  $('ext-fields').appendChild(wrap);
}

// 清空所有键值对
function clearExtFields() {
  const c = $('ext-fields');
  if (c) c.innerHTML = '';
}

// 收集当前键值对，生成 ext JSON 字符串
function getExtJson() {
  const obj = {};
  document.querySelectorAll('#ext-fields .ext-row').forEach((row) => {
    const k = row.querySelector('.ext-key').value.trim();
    const v = row.querySelector('.ext-val').value.trim();
    if (!k) return; // 空 key 忽略
    let val = v;
    // 仅当以 { 或 [ 开头时尝试解析为对象/数组；普通键值（如 versionCode="11000"）保持字符串所见即所得
    if (v !== '' && /^[\[{]/.test(v)) {
      try { val = JSON.parse(v); } catch (e) { /* 保留字符串 */ }
    }
    obj[k] = val;
  });
  return Object.keys(obj).length ? JSON.stringify(obj) : '{}';
}

// 打开源文件时加载该源保存过的 ext 参数（解析成键值对行）
async function loadExt(name) {
  try {
    const data = await api('/api/ext?path=' + encodeURIComponent(name));
    const ext = data.ext || '{}';
    clearExtFields();
    let obj = {};
    try { obj = JSON.parse(ext); } catch (e) { /* 非法 JSON 按空处理 */ }
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach((k) => addExtRow(k, obj[k]));
    }
    if (!Object.keys(obj).length) addExtRow('', '');
  } catch (e) {
    /* 无保存记录或请求失败时保持空 */
  }
}

// 把当前 ext 键值对保存到当前源，动态源（如 Hmys 需要 host/appid）可跨会话复用
async function saveExt() {
  if (!currentFile) return;
  try {
    await post('/api/ext', { path: currentFile.name, ext: getExtJson() });
  } catch (e) {
    /* 保存失败不阻断调试 */
  }
}

function setupDebug(type) {
  const sel = $('dbg-method');
  sel.innerHTML = '';
  const methods = type === 'js' ? JS_METHODS : PY_METHODS;
  methods.forEach((m) => sel.appendChild(el('option', '', m)));
  sel.value = methods[1] || methods[0];
  onMethodChange();
}

function onMethodChange() {
  const m = $('dbg-method').value;
  const isJs = currentFile && currentFile.type === 'js';
  const fast = isJs ? JS_FAST[m] : PY_FAST[m];
  $('dbg-args').value = fast && Object.keys(fast).length ? JSON.stringify(fast, null, 2) : '';
  $('dbg-args-label').textContent = isJs ? '参数（JSON 位置参数数组）' : '参数（JSON 关键字参数字典）';
}

function parseArgsInput() {
  const txt = $('dbg-args').value.trim();
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch (e) {
    throw new Error('参数不是合法 JSON: ' + e.message);
  }
}

async function runDebug() {
  if (!currentFile) return alert('请先打开一个源文件');
  const method = $('dbg-method').value;
  const ext = getExtJson();
  let args;
  try {
    args = parseArgsInput();
  } catch (e) {
    alert(e.message);
    return;
  }
  const btn = $('btn-run');
  btn.disabled = true;
  btn.textContent = '运行中…';
  showTab('result', '<pre>正在执行 ' + method + '() …</pre>');
  try {
    // 自动保存当前 ext，模拟器下次运行时即可使用
    saveExt();
    let data;
    if (currentFile.type === 'js') {
      data = await post('/api/debug/js', { path: currentFile.name, method, args, ext });
    } else {
      data = await post('/api/debug/py', { path: currentFile.name, method, kwargs: args, ext });
    }
    renderDebug(data);
  } catch (e) {
    showTab('error', '<pre class="err">' + escapeHtml(e.message) + '</pre>');
  } finally {
    btn.disabled = false;
    btn.textContent = '运行';
  }
}

function renderDebug(data) {
  const result = data.result;
  let resultHtml;
  if (result === null || result === undefined) {
    resultHtml = '<pre>（返回空）</pre>';
  } else if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      resultHtml = '<pre class="ok">' + escapeHtml(JSON.stringify(parsed, null, 2)) + '</pre>';
    } catch (e) {
      resultHtml = '<pre>' + escapeHtml(result) + '</pre>';
    }
  } else {
    resultHtml = '<pre class="ok">' + escapeHtml(JSON.stringify(result, null, 2)) + '</pre>';
  }

  const logs = (data.logs || []).map((l) => '<div class="logline">' + escapeHtml(l) + '</div>').join('') || '<pre>（无日志）</pre>';

  const requests =
    '<table><tr><th>#</th><th>方法</th><th>URL</th><th>状态</th><th>大小</th></tr>' +
    (data.requests || [])
      .map(
        (r, i) =>
          '<tr><td>' +
          (i + 1) +
          '</td><td>' +
          escapeHtml(r.method) +
          '</td><td class="url">' +
          escapeHtml(r.url) +
          '</td><td>' +
          (r.status || '-') +
          '</td><td>' +
          (r.size || '-') +
          '</td></tr>'
      )
      .join('') +
    '</table>';
  const stdout = data.pyOut ? '<pre>' + escapeHtml(data.pyOut) + '</pre>' : '<pre>（无输出）</pre>';
  const err = data.error ? '<pre class="err">' + escapeHtml(data.error) + '</pre>' : '<pre>（无错误）</pre>';

  setTabContent('result', resultHtml);
  setTabContent('logs', logs);
  setTabContent('requests', requests);
  setTabContent('stdout', stdout);
  setTabContent('error', err);

  // 错误徽标
  const tabErr = document.querySelector('.rtab[data-tab="error"]');
  tabErr.querySelectorAll('.badge').forEach((b) => b.remove());
  if (data.error) {
    const b = el('span', 'badge', '!');
    tabErr.appendChild(b);
  }
  showTab(data.error ? 'error' : 'result');
}

// ============ 结果页签 ============
const tabViews = {};
function setTabContent(tab, html) {
  tabViews[tab] = html;
  const active = document.querySelector('.rtab.active');
  if (active && active.dataset.tab === tab) {
    $('result-view').innerHTML = html;
  }
}
function showTab(tab) {
  document.querySelectorAll('.rtab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('result-view').innerHTML = tabViews[tab] || '<pre>（空）</pre>';
}
document.querySelectorAll('.rtab').forEach((t) => {
  t.addEventListener('click', () => showTab(t.dataset.tab));
});

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============ 向导 ============
function openWizard() {
  $('modal-mask').classList.add('show');
}
function closeWizard() {
  $('modal-mask').classList.remove('show');
}
async function wizardOk() {
  const name = $('wz-name').value.trim();
  if (!name) return alert('请填写站点名称');
  const lang = document.querySelector('input[name="wz-lang"]:checked').value;
  const input = {
    name,
    lang,
    host: $('wz-host').value.trim(),
    ext: $('wz-ext').value.trim(),
    classesText: $('wz-classes').value,
  };
  const fileBase = $('wz-file').value.trim() || name;
  try {
    const data = await post('/api/wizard', input);
    const created = [];
    if (data.js) {
      await post('/api/file/new', { filename: data.js.filename, lang: 'js', content: data.js.content });
      created.push(data.js.filename);
    }
    if (data.py) {
      await post('/api/file/new', { filename: data.py.filename, lang: 'py', content: data.py.content });
      created.push(data.py.filename);
    }
    closeWizard();
    await loadFiles();
    if (created.length) openFile(created[0]);
  } catch (e) {
    alert('生成失败: ' + e.message);
  }
}

// ============ 初始化 ============
function initEvents() {
  $('btn-refresh').addEventListener('click', loadFiles);
  $('btn-new').addEventListener('click', openWizard);
  $('btn-new2').addEventListener('click', openWizard);
  $('btn-save').addEventListener('click', saveFile);
  $('btn-run').addEventListener('click', runDebug);
  $('dbg-method').addEventListener('change', onMethodChange);
  $('btn-add-ext').addEventListener('click', () => addExtRow('', ''));
  $('btn-close-modal').addEventListener('click', closeWizard);
  $('btn-wizard-cancel').addEventListener('click', closeWizard);
  $('btn-wizard-ok').addEventListener('click', wizardOk);
  $('modal-mask').addEventListener('click', (e) => {
    if (e.target === $('modal-mask')) closeWizard();
  });
  $('wz-name').addEventListener('input', () => {
    if (!$('wz-file').value.trim() || $('wz-file').dataset.auto !== '0') {
      $('wz-file').value = $('wz-name').value.trim();
      $('wz-file').dataset.auto = '1';
    }
  });
  $('wz-file').addEventListener('input', () => {
    $('wz-file').dataset.auto = '0';
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
  });

  // 移动端底部导航：切换「编辑器 / 源文件 / 调试」三个视图
  const nav = $('mobile-nav');
  if (nav) {
    nav.querySelectorAll('.m-tab').forEach((b) => {
      b.addEventListener('click', () => mobileShowArea(b.dataset.show));
    });
  }
}

// 窄屏下切换显示某个区域（files / editor-area / debug），并让编辑器重算尺寸
function mobileShowArea(id) {
  const nav = $('mobile-nav');
  if (!nav) return;
  nav.querySelectorAll('.m-tab').forEach((b) => b.classList.toggle('active', b.dataset.show === id));
  ['files', 'editor-area', 'debug'].forEach((pid) => {
    const node = $(pid);
    if (node) node.classList.toggle('active', pid === id);
  });
  if (editor) setTimeout(() => editor.layout(), 50);
}

async function loadEnv() {
  try {
    const data = await api('/api/env');
    const pyTxt = data.python ? data.python.version + ' (' + data.python.cmd + ')' : '未检测到';
    $('env-info').textContent = 'Node ' + data.node + ' | Python ' + pyTxt;
  } catch (e) {
    $('env-info').textContent = '环境检测失败';
  }
}

initMonaco((m) => {
  editor = m.editor.create($('editor'), {
    theme: 'vs-dark',
    language: 'javascript',
    automaticLayout: true,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    tabSize: 4,
  });
  editor.onDidChangeModelContent(() => {
    if (currentFile) {
      dirty = true;
      $('dirty-mark').textContent = '● 未保存';
    }
  });
  $('editor').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    }
  });
  loadFiles();
  loadEnv();
});

initEvents();
