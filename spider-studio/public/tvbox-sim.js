/**
 * TVBox 模拟器 - 与调试台共用右侧面板宽度，tab 切换显示
 *
 * 切换到「模拟器」tab 时，若已打开源文件则自动从 init 运行：
 *   init → home(分类/筛选) + homeVod(首页列表) 渲染首页
 * 顶部搜索框 → search；点分类 chip → category；点卡片 → detail；点剧集 → play
 *
 * 复用 app.js 提供的全局工具：$ / post / escapeHtml / currentFile
 */
'use strict';

// ============ 方法映射（JS / PY 双端） ============
function simMap(isJs) {
  return {
    home: isJs ? 'home' : 'homeContent',
    homeVod: isJs ? 'homeVod' : 'homeVideoContent',
    category: isJs ? 'category' : 'categoryContent',
    detail: isJs ? 'detail' : 'detailContent',
    search: isJs ? 'search' : 'searchContent',
    play: isJs ? 'play' : 'playerContent',
  };
}

// 根据逻辑方法构造调用参数（JS 位置参数数组 / PY 关键字参数字典）
function simArgs(isJs, kind, p) {
  if (isJs) {
    switch (kind) {
      case 'home': return [true];
      case 'homeVod': return [];
      case 'category': return [p.tid, p.pg, true, {}];
      case 'detail': return [p.id];
      case 'search': return [p.key, false, p.pg || '1'];
      case 'play': return ['在线播放', p.id, []];
    }
  } else {
    switch (kind) {
      case 'home': return { filter: {} };
      case 'homeVod': return {};
      case 'category': return { tid: p.tid, pg: p.pg, filter: true, ext: {} };
      case 'detail': return { ids: [p.id] };
      case 'search': return { key: p.key, quick: false, pg: p.pg || '1' };
      case 'play': return { flag: '在线播放', id: p.id, vipflags: [] };
    }
  }
  return {};
}

// 调用调试 API（后端自动 init），返回 result 对象
async function simRun(kind, p) {
  if (!currentFile) throw new Error('未打开源文件');
  const isJs = currentFile.type === 'js';
  const m = simMap(isJs);
  const args = simArgs(isJs, kind, p || {});
  // 与调试台共用 ext 参数
  const extEl = document.getElementById('dbg-ext');
  const ext = (extEl && extEl.value.trim()) || '{}';
  const body = isJs
    ? { path: currentFile.name, method: m[kind], args, ext }
    : { path: currentFile.name, method: m[kind], kwargs: args, ext };
  const data = await post(isJs ? '/api/debug/js' : '/api/debug/py', body);
  if (data.error) throw new Error(data.error);
  let result = data.result;
  if (typeof result === 'string') result = JSON.parse(result);
  return result;
}

// ============ 状态与历史 ============
const sim = {
  stack: [],    // 历史栈 { title, html }
  classes: [],  // 首页分类
  filters: null,
  gen: 0,       // 世代计数：防止慢请求返回后覆盖新内容
  loaded: false, // 是否已自动加载首页
};

function simScreenHtml(title, body) {
  return '<div class="tvbox">' +
    '<div class="tv-status"><span class="tv-dot"></span><span class="tv-title">' + escapeHtml(title) + '</span></div>' +
    body + '</div>';
}

function simRender(title, body) {
  const html = simScreenHtml(title, body);
  sim.stack.push({ title, html });
  $('sim-screen').innerHTML = html;
}

function simErr(e) {
  $('sim-screen').innerHTML = '<div class="sim-intro err">' + escapeHtml((e && e.message) || String(e)) + '</div>';
}

// ============ TVBox 渲染工具 ============
function tvSection(label, html) {
  return '<div class="tv-sec"><div class="tv-sec-label">' + escapeHtml(label) + '</div>' + html + '</div>';
}

function tvGrid(list) {
  return '<div class="tv-grid">' + (list || []).map(tvCard).join('') + '</div>';
}

function tvCard(v) {
  const name = v.vod_name || '(无名)';
  const pic = v.vod_pic || '';
  const remark = v.vod_remarks || '';
  const did = v.vod_id != null && String(v.vod_id) !== '' ? ' data-id="' + escapeHtml(String(v.vod_id)) + '"' : '';
  const poster = pic ? '<img loading="lazy" src="' + escapeHtml(pic) + '" alt="" onerror="this.style.display=\'none\'">' : '';
  return '<div class="tv-card"' + did + '>' +
    '<div class="tv-pic">' + poster + (remark ? '<span class="tv-rmk">' + escapeHtml(remark) + '</span>' : '') + '</div>' +
    '<div class="tv-name" title="' + escapeHtml(name) + '">' + escapeHtml(name) + '</div></div>';
}

// 解析 vod_play_url（兼容标准格式与"源名$集数$id$ji"自定义格式）
function parsePlaySources(playUrl, playFrom) {
  const sources = String(playUrl).split('$$').filter(Boolean);
  const names = String(playFrom || '').split('$$').filter(Boolean);
  return sources.map((src, i) => {
    const name = names[i] && names[i] !== '$' ? names[i] : '线路' + (i + 1);
    let raw = src;
    // 标准格式带"源名$"，且源名在 playFrom 中已知时剥掉它
    if (names[i]) {
      if (raw.startsWith(name + '$')) raw = raw.slice(name.length + 1);
      else if (raw.indexOf('$') > -1 && raw.split('$')[0] === name) raw = raw.slice(raw.indexOf('$') + 1);
    }
    const eps = raw.split('#').filter(Boolean);
    return { name, eps };
  });
}

function tvDetail(v) {
  const name = v.vod_name || '';
  const pic = v.vod_pic || '';
  const poster = pic
    ? '<img class="tv-dpic" src="' + escapeHtml(pic) + '" alt="" onerror="this.style.display=\'none\'">'
    : '<div class="tv-dpic tv-dpic-empty">' + escapeHtml(name || '无封面') + '</div>';
  const rows = [
    ['状态', v.vod_remarks], ['年份', v.vod_year], ['地区', v.vod_area],
    ['导演', v.vod_director], ['主演', v.vod_actor],
  ].filter(([, val]) => val != null && String(val) !== '')
    .map(([k, val]) => '<div class="tv-drow"><span class="dk">' + k + '</span><span>' + escapeHtml(String(val)) + '</span></div>').join('');
  const content = String(v.vod_content || '').replace(/<[^>]+>/g, '');
  let epsHtml = '';
  const playFrom = v.vod_play_from || '';
  const playUrl = v.vod_play_url || '';
  if (playUrl) {
    const sources = parsePlaySources(playUrl, playFrom);
    sources.forEach((s) => {
      epsHtml += '<div class="tv-line">▶ ' + escapeHtml(s.name) + '（' + s.eps.length + ' 集）</div><div class="tv-eps">';
      epsHtml += s.eps.map((ep) => {
        const str = String(ep);
        const label = str.split('$')[0];
        const id = str.indexOf('$') > -1 ? str.split('$').slice(1).join('$') : str;
        return '<button class="ep" data-id="' + escapeHtml(id) + '" title="' + escapeHtml(str) + '">' + escapeHtml(label) + '</button>';
      }).join('');
      epsHtml += '</div>';
    });
  }
  return '<div class="tv-detail">' +
    '<div class="tv-dhead">' + poster + '<div class="tv-dinfo"><div class="tv-dname">' + escapeHtml(name) + '</div>' + rows + '</div></div>' +
    (content ? tvSection('简介', '<div class="tv-dcontent">' + escapeHtml(content) + '</div>') : '') +
    (epsHtml ? tvSection('选集', epsHtml) : '') +
    '</div>';
}

// ============ 首页 / 分类 / 详情 / 搜索 / 播放 ============
// 从 init 运行：home(分类) + homeVod(首页列表) 渲染
async function simEnter() {
  if (!currentFile) {
    $('sim-screen').innerHTML = '<div class="sim-intro">请先在左侧打开一个源文件</div>';
    return;
  }
  const gen = ++sim.gen;
  sim.loaded = true;
  sim.stack = [];
  $('sim-screen').innerHTML = '<div class="sim-loading">正在初始化并加载首页…</div>';
  try {
    const home = await simRun('home');       // { class, filters }
    if (gen !== sim.gen) return;
    const homeVod = await simRun('homeVod'); // { list }
    if (gen !== sim.gen) return;
    sim.classes = (home && home.class) || [];
    sim.filters = (home && home.filters) || null;
    const list = (homeVod && homeVod.list) || [];
    let body = '';
    if (sim.classes.length) {
      body += tvSection('分类', '<div class="tv-chips">' + sim.classes
        .map((c) => '<button class="chip tv-chip" data-tid="' + escapeHtml(c.type_id) + '">' + escapeHtml(c.type_name || c.type_id) + '</button>')
        .join('') + '</div>');
    }
    body += tvSection('推荐', tvGrid(list));
    simRender('首页 · ' + currentFile.name, body);
  } catch (e) {
    sim.loaded = false;
    if (gen === sim.gen) simErr(e);
  }
}

async function simCategory(tid) {
  const gen = ++sim.gen;
  $('sim-screen').innerHTML = '<div class="sim-loading">加载分类「' + escapeHtml(tid) + '」…</div>';
  try {
    const r = await simRun('category', { tid, pg: '1' });
    if (gen !== sim.gen) return;
    const list = (r && r.list) || [];
    let body = '';
    if (r && (r.page != null || r.pagecount != null || r.total != null)) {
      body += '<div class="tv-pages">第 <b>' + escapeHtml(r.page || 1) + '</b> 页 / 共 <b>' +
        escapeHtml(r.pagecount || 1) + '</b> 页 · 共 <b>' + escapeHtml(r.total || 0) + '</b> 条</div>';
    }
    body += tvGrid(list);
    simRender('分类：' + tid, body);
  } catch (e) {
    if (gen === sim.gen) simErr(e);
  }
}

async function simDetail(id) {
  const gen = ++sim.gen;
  $('sim-screen').innerHTML = '<div class="sim-loading">加载详情…</div>';
  try {
    const r = await simRun('detail', { id });
    if (gen !== sim.gen) return;
    const v = (r && r.list && r.list[0]) || {};
    simRender('详情', tvDetail(v));
  } catch (e) {
    if (gen === sim.gen) simErr(e);
  }
}

async function simSearch() {
  const keyEl = $('sim-search');
  const key = (keyEl && keyEl.value.trim()) || '';
  if (!key) return;
  const gen = ++sim.gen;
  $('sim-screen').innerHTML = '<div class="sim-loading">搜索「' + escapeHtml(key) + '」…</div>';
  try {
    const r = await simRun('search', { key });
    if (gen !== sim.gen) return;
    const list = (r && r.list) || [];
    const body = '<div class="tv-pages">搜索「' + escapeHtml(key) + '」共 <b>' + list.length + '</b> 条</div>' + tvGrid(list);
    simRender('搜索：' + key, body);
  } catch (e) {
    if (gen === sim.gen) simErr(e);
  }
}

async function simPlay(id) {
  const gen = ++sim.gen;
  $('sim-screen').innerHTML = '<div class="sim-loading">解析播放地址…</div>';
  try {
    const r = await simRun('play', { id });
    if (gen !== sim.gen) return;
    const url = (r && r.url) || '';
    const parse = r && (r.parse != null ? r.parse : r.jx);
    const body = '<div class="tv-player"><div class="tv-player-icon">▶</div>' +
      '<div class="tv-player-url">' + escapeHtml(url) + '</div>' +
      '<div class="tv-player-note">该地址将交给播放器播放（parse=' + escapeHtml(String(parse != null ? parse : '')) + '）</div></div>';
    simRender('播放', body);
  } catch (e) {
    if (gen === sim.gen) simErr(e);
  }
}

// ============ 导航 ============
function simBack() {
  if (sim.stack.length <= 1) { simEnter(); return; }
  sim.stack.pop();
  $('sim-screen').innerHTML = sim.stack[sim.stack.length - 1].html;
}

// 打开新文件时重置模拟器（下次切到模拟器 tab 自动重新加载）
function simReset() {
  sim.stack = [];
  sim.gen++;
  sim.loaded = false;
  const search = $('sim-search');
  if (search) search.value = '';
  $('sim-screen').innerHTML =
    '<div class="sim-intro">在左侧打开一个源文件，然后切换到「模拟器」标签。<br />将自动从 init 运行并渲染分类与首页列表。</div>';
}

// ============ tab 切换 ============
// 调试台与模拟器共用一个面板宽度，点击 tab 后另一个隐藏
function simSwitchTab(pane) {
  document.querySelectorAll('#debug .side-tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.pane === pane);
  });
  const dbg = $('pane-dbg');
  const simPane = $('pane-sim');
  if (dbg) dbg.classList.toggle('hidden', pane !== 'pane-dbg');
  if (simPane) simPane.classList.toggle('hidden', pane !== 'pane-sim');
  // 切到模拟器：若已打开源文件且尚未加载，自动从 init 运行
  if (pane === 'pane-sim' && currentFile && !sim.loaded) simEnter();
}

// ============ 事件绑定 ============
// 安全绑定：元素不存在时跳过，避免单个元素缺失导致整个模拟器失效
function simOn(id, ev, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(ev, fn);
}

function simBind() {
  simOn('tab-dbg', 'click', () => simSwitchTab('pane-dbg'));
  simOn('tab-sim', 'click', () => simSwitchTab('pane-sim'));
  simOn('sim-refresh', 'click', simEnter);
  simOn('sim-back', 'click', simBack);
  simOn('sim-search-btn', 'click', simSearch);
  simOn('sim-search', 'keydown', (e) => {
    if (e.key === 'Enter') simSearch();
  });
  // 屏幕内点击：卡片→详情 / 分类→分类列表 / 剧集→播放
  simOn('sim-screen', 'click', (e) => {
    const card = e.target.closest('.tv-card[data-id]');
    if (card) { simDetail(card.dataset.id); return; }
    const chip = e.target.closest('.tv-chip[data-tid]');
    if (chip) { simCategory(chip.dataset.tid); return; }
    const ep = e.target.closest('.ep[data-id]');
    if (ep) { simPlay(ep.dataset.id); return; }
  });
}

simBind();
