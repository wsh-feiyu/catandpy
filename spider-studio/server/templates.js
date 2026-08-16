/**
 * 骨架模板 + 向导生成
 */
'use strict';

// ============ JS 源骨架模板 ============
const JS_TEMPLATE = `/**
 * {{NAME}} - TVBox 猫源 JS 爬虫（由 Spider Studio 生成）
 *
 * 参考规范: FongMi/TV SPIDER.md
 * 关键接口（在 QuickJS 中执行，调试环境已 mock）:
 *   init(cfg)        : 初始化，cfg.ext 为站点扩展参数(JSON字符串)
 *   home(filter)     : 首页分类，返回 JSON 字符串 {class:[], filters:{}}
 *   homeVod()        : 首页推荐，返回 JSON 字符串 {list:[]}
 *   category(tid, pg, filter, extend): 分类列表 {list:[], pagecount}
 *   detail(ids)      : 详情，返回 {list:[Vod]}
 *   play(flag, id, flags): 播放解析，返回 {parse:0, url}
 *   search(wd, quick, pg): 搜索 {list:[]}
 *
 * 内置可用函数: req / aesX / md5X / sniff / base64 / pd / pdfh / pdfa / Crypto
 */

// 站点域名（可留空，运行时从 ext 传入 host）
let HOST = '{{HOST}}';
// 扩展参数示例：{"key":"xxx","version":"1.0","host":"https://example.com"}
let EXT_DEFAULT = {{EXT_DEFAULT}};

// ============ 初始化 ============
async function init(cfg) {
    // cfg.skey: 站点key, cfg.stype: 站点类型, cfg.ext: 扩展参数(JSON字符串或对象)
    try {
        let ext = typeof cfg.ext === 'string' ? JSON.parse(cfg.ext) : (cfg.ext || {});
        if (ext.host) HOST = ext.host;
        else if (!HOST) HOST = '{{HOST}}';
        console.log('[init] host =', HOST);
    } catch (e) {}
}

// ============ 首页分类 ============
async function home(filter) {
    const classes = {{CLASSES}};
    return JSON.stringify({ class: classes, filters: {} });
}

// ============ 首页推荐（可选实现） ============
async function homeVod() {
    // TODO: 抓取首页推荐接口
    // const resp = await req(HOST + '/home.json');
    // const data = JSON.parse(resp.content);
    // return JSON.stringify({ list: data.map(it => ({ vod_id: it.id, vod_name: it.name, vod_pic: it.pic })) });
    return '{}';
}

// ============ 分类列表 ============
async function category(tid, pg, filter, extend) {
    try {
        // TODO: 替换为真实列表接口
        const url = HOST + '/list?tid=' + tid + '&pg=' + pg;
        const resp = await req(url);
        const data = JSON.parse(resp.content);
        const list = (data.list || []).map(it => ({
            vod_id: it.id,           // 影片ID（详情页用）
            vod_name: it.name,       // 名称
            vod_pic: it.pic || '',   // 封面
            vod_remarks: it.remarks || '' // 备注（更新至xx集）
        }));
        return JSON.stringify({ list, pagecount: data.pagecount || 999 });
    } catch (e) {
        console.error('category error:', e.message);
        return '{}';
    }
}

// ============ 详情页 ============
async function detail(ids) {
    try {
        let id = String(ids);
        // TODO: 替换为真实详情接口
        const resp = await req(HOST + '/detail?id=' + id);
        const d = JSON.parse(resp.content);
        // 选集格式: 集数名$集数ID，多组用 # 连接；多线路用 $$$ 分隔
        const eps = (d.episodes || []).map(e => e.name + '$' + e.url).join('#');
        return JSON.stringify({
            list: [{
                vod_id: id,
                vod_name: d.name || '',
                vod_pic: d.pic || '',
                vod_year: d.year || '',
                vod_area: d.area || '',
                vod_director: d.director || '',
                vod_actor: d.actor || '',
                vod_content: d.desc || '',
                vod_play_from: '线路1',       // 播放来源名
                vod_play_url: eps
            }]
        });
    } catch (e) {
        console.error('detail error:', e.message);
        return '{}';
    }
}

// ============ 播放解析 ============
async function play(flag, id, flags) {
    try {
        // id 为 detail 里 vod_play_url 传过来的集数 value
        // 若已是直链，直接返回：
        return JSON.stringify({ parse: 0, url: id });
        // 若需要解析器：return JSON.stringify({ parse: 1, playUrl: '解析器名称', url: id });
        // 若需要自定义 header：return JSON.stringify({ parse: 0, url: id, header: { 'User-Agent': '...' } });
    } catch (e) {
        console.error('play error:', e.message);
        return '{}';
    }
}

// ============ 搜索 ============
async function search(wd, quick, pg) {
    try {
        const url = HOST + '/search?wd=' + encodeURIComponent(wd) + '&pg=' + (pg || '1');
        const resp = await req(url);
        const data = JSON.parse(resp.content);
        const list = (data.list || []).map(it => ({
            vod_id: it.id,
            vod_name: it.name,
            vod_pic: it.pic || '',
            vod_remarks: it.remarks || ''
        }));
        return JSON.stringify({ list });
    } catch (e) {
        console.error('search error:', e.message);
        return '{}';
    }
}

export function __jsEvalReturn() {
    return { init, home, homeVod, category, detail, play, search };
}
`;

// ============ PY 源骨架模板 ============
const PY_TEMPLATE = `# -*- coding: utf-8 -*-
# {{NAME}} - TVBox 猫源 PY 爬虫（由 Spider Studio 生成）
# 参考规范: FongMi/TV SPIDER.md
# 基类 base.spider.Spider 在本地调试时已 mock（fetch/json/html/pdfh 等）

from base.spider import Spider
import json

class Spider(Spider):
    host = '{{HOST}}'

    # ============ 初始化 ============
    def init(self, extend=''):
        # extend 为站点扩展参数（JSON字符串）
        try:
            if isinstance(extend, dict):
                ext = extend
            elif isinstance(extend, str) and extend.strip():
                ext = json.loads(extend.strip())
            else:
                ext = {}
            if ext.get('host'):
                self.host = ext['host']
        except Exception:
            pass

    # ============ 首页分类 ============
    def homeContent(self, filter):
        classes = {{CLASSES}}
        return {'class': classes, 'filters': {}}

    # ============ 首页推荐 ============
    def homeVideoContent(self):
        # TODO: 抓取首页推荐
        return {'list': []}

    # ============ 分类列表 ============
    def categoryContent(self, tid, pg, filter, ext):
        try:
            # TODO: 替换为真实列表接口
            url = self.host + '/list?tid=' + str(tid) + '&pg=' + str(pg)
            data = json.loads(self.fetch(url, verify=False).text)
            videos = []
            for it in data.get('list', []):
                videos.append({
                    'vod_id': it.get('id'),
                    'vod_name': it.get('name'),
                    'vod_pic': it.get('pic', ''),
                    'vod_remarks': it.get('remarks', '')
                })
            return {'list': videos, 'page': pg, 'pagecount': data.get('pagecount', 999)}
        except Exception:
            return None

    # ============ 搜索 ============
    def searchContent(self, key, quick, pg='1'):
        try:
            url = self.host + '/search?wd=' + quote(key) + '&pg=' + str(pg)
            data = json.loads(self.fetch(url, verify=False).text)
            videos = []
            for it in data.get('list', []):
                videos.append({
                    'vod_id': it.get('id'),
                    'vod_name': it.get('name'),
                    'vod_pic': it.get('pic', ''),
                    'vod_remarks': it.get('remarks', '')
                })
            return {'list': videos, 'page': pg}
        except Exception:
            return None

    # ============ 详情页 ============
    def detailContent(self, ids):
        try:
            vid = str(ids[0])
            if '#' in vid:
                vid = vid.split('#')[0]
            url = self.host + '/detail?id=' + vid
            d = json.loads(self.fetch(url, verify=False).text)
            eps = '#'.join([str(e.get('name')) + '$' + str(e.get('url')) for e in d.get('episodes', [])])
            video = {
                'vod_id': vid,
                'vod_name': d.get('name', ''),
                'vod_pic': d.get('pic', ''),
                'vod_year': d.get('year', ''),
                'vod_area': d.get('area', ''),
                'vod_director': d.get('director', ''),
                'vod_actor': d.get('actor', ''),
                'vod_content': d.get('desc', ''),
                'vod_play_from': '线路1',
                'vod_play_url': eps
            }
            return {'list': [video]}
        except Exception:
            return None

    # ============ 播放解析 ============
    def playerContent(self, flag, id, vipflags):
        # id 为 detail 里 vod_play_url 传过来的集数 value
        return {'jx': '0', 'parse': '0', 'url': id}

    def getName(self):
        pass

    def isVideoFormat(self, url):
        return True

    def manualVideoCheck(self):
        return False

    def destroy(self):
        pass
`;

function getTemplates() {
  return { js: JS_TEMPLATE, py: PY_TEMPLATE };
}

// ============ 向导生成 ============
// input: { name, lang('js'|'py'|'both'), host, ext, classesText }
// classesText: 每行 "type_id,type_name" 或 JSON
function parseClasses(text) {
  const classes = [];
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const segs = line.split(/[,，\t]/).map((s) => s.trim()).filter(Boolean);
    if (segs.length >= 2) classes.push({ type_id: segs[0], type_name: segs[1] });
    else if (segs.length === 1) classes.push({ type_id: segs[0], type_name: segs[0] });
  }
  if (!classes.length) {
    classes.push(
      { type_id: '剧集', type_name: '剧集' },
      { type_id: '电影', type_name: '电影' }
    );
  }
  return classes;
}

function generateWizardSource(input) {
  const name = input.name || '新站点';
  const host = input.host || 'https://example.com';
  const classes = parseClasses(input.classesText);

  const out = {};
  if (input.lang === 'js' || input.lang === 'both') {
    out.js = {
      type: 'js',
      filename: (input.fileNameJs || name) + '.js',
      content: JS_TEMPLATE
        .replace(/{{NAME}}/g, name)
        .replace(/{{HOST}}/g, host)
        .replace('{{EXT_DEFAULT}}', input.ext ? JSON.stringify(input.ext) : '{}')
        .replace('{{CLASSES}}', JSON.stringify(classes, null, 4)),
    };
  }
  if (input.lang === 'py' || input.lang === 'both') {
    out.py = {
      type: 'py',
      filename: (input.fileNamePy || name) + '.py',
      content: PY_TEMPLATE
        .replace(/{{NAME}}/g, name)
        .replace(/{{HOST}}/g, host)
        .replace('{{CLASSES}}', JSON.stringify(classes, null, 4)),
    };
  }
  return out;
}

module.exports = { getTemplates, generateWizardSource, JS_TEMPLATE, PY_TEMPLATE };
