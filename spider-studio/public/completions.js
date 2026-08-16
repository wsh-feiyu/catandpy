/**
 * Monaco 自动补全：TVBox 猫源 API
 */
'use strict';

// JS 源：QuickJS 内置函数 + cat.js + 接口骨架
const JS_SUGGESTIONS = [
  {
    label: 'req(url, opt)',
    kind: 'Function',
    insertText: 'await req(${1:url}${2:, { headers: { \'User-Agent\': \'...\' } }})',
    detail: 'HTTP 请求，返回 {content, code, json(), html()}',
    doc: '请求接口。opt 支持 {method, headers, body, ua, redirect}。返回对象含 .content(文本)、.json()、.html()、.code。',
  },
  {
    label: 'aesX(mode, inBase64, data, isBase64, key, outBase64, noPad)',
    kind: 'Function',
    insertText: 'aesX(\'AES/ECB/No\', ${1:true}, ${2:data}, ${3:true}, ${4:key}, ${5:true}, ${6:true})',
    detail: 'AES 加解密（cat 封装）',
    doc: 'mode: AES/ECB/No、AES/CBC/PKCS7Padding 等；inBase64=true 解密、false 加密；isBase64 表示 key 是否 base64；outBase64 默认同 inBase64。',
  },
  {
    label: 'md5X(str)',
    kind: 'Function',
    insertText: 'md5X(${1:str})',
    detail: 'MD5 十六进制哈希',
    doc: '返回小写 hex MD5。',
  },
  {
    label: 'sniff(url)',
    kind: 'Function',
    insertText: 'await sniff(${1:url})',
    detail: '嗅探实际播放地址',
    doc: '调试环境返回原样。',
  },
  {
    label: 'base64.encode(str)',
    kind: 'Function',
    insertText: 'base64.encode(${1:str})',
    detail: 'Base64 编码',
  },
  {
    label: 'base64.decode(str)',
    kind: 'Function',
    insertText: 'base64.decode(${1:str})',
    detail: 'Base64 解码',
  },
  {
    label: 'pd(html, rule)',
    kind: 'Function',
    insertText: 'pd(${1:html}, \'${2:正则}\')',
    detail: '正则取第一个匹配',
  },
  {
    label: 'pdfh(html, rule)',
    kind: 'Function',
    insertText: 'pdfh(${1:html}, \'${2:规则}\')',
    detail: 'jsoup 风格解析（调试版按正则）',
  },
  {
    label: 'pdfa(html, rule)',
    kind: 'Function',
    insertText: 'pdfa(${1:html}, \'${2:规则}\')',
    detail: '取所有匹配',
  },
  {
    label: 'Crypto.enc.Base64.parse(str)',
    kind: 'Function',
    insertText: 'Crypto.enc.Base64.parse(${1:str})',
    detail: 'Base64 -> WordArray',
    doc: '来自 assets://js/lib/cat.js 的 CryptoJS。',
  },
  {
    label: 'Crypto.enc.Utf8.stringify(wa)',
    kind: 'Function',
    insertText: 'Crypto.enc.Utf8.stringify(${1:wordArray})',
    detail: 'WordArray -> UTF8 字符串',
  },
  {
    label: 'Crypto.lib.WordArray.create(words, sigBytes)',
    kind: 'Function',
    insertText: 'Crypto.lib.WordArray.create(${1:words}, ${2:sigBytes})',
    detail: '创建 WordArray',
  },
  {
    label: 'Crypto.MD5(str)',
    kind: 'Function',
    insertText: 'Crypto.MD5(${1:str}).toString()',
    detail: 'MD5',
  },
  {
    label: 'console.log(...)',
    kind: 'Function',
    insertText: 'console.log(${1:msg})',
    detail: '调试日志（会显示在调试台日志页）',
  },
  {
    label: 'async function home(filter)',
    kind: 'Snippet',
    insertText:
      'async function home(filter) {\n    const classes = [\n        { type_id: \'剧集\', type_name: \'剧集\' },\n        { type_id: \'电影\', type_name: \'电影\' }\n    ];\n    return JSON.stringify({ class: classes, filters: {} });\n}',
    detail: '首页分类接口',
  },
  {
    label: 'async function homeVod()',
    kind: 'Snippet',
    insertText:
      'async function homeVod() {\n    try {\n        const resp = await req(HOST + \'${1:/home.json}\');\n        const data = JSON.parse(resp.content);\n        const list = (data.list || []).map(it => ({\n            vod_id: it.id,\n            vod_name: it.name,\n            vod_pic: it.pic || \'\',\n            vod_remarks: it.remarks || \'\'\n        }));\n        return JSON.stringify({ list });\n    } catch (e) {\n        return \'{}\';\n    }\n}',
    detail: '首页推荐接口',
  },
  {
    label: 'async function category(tid, pg, filter, extend)',
    kind: 'Snippet',
    insertText:
      'async function category(tid, pg, filter, extend) {\n    try {\n        const url = HOST + \'${1:/list?tid=}\' + tid + \'&pg=\' + pg;\n        const resp = await req(url);\n        const data = JSON.parse(resp.content);\n        const list = (data.list || []).map(it => ({\n            vod_id: it.id,\n            vod_name: it.name,\n            vod_pic: it.pic || \'\',\n            vod_remarks: it.remarks || \'\'\n        }));\n        return JSON.stringify({ list, pagecount: data.pagecount || 999 });\n    } catch (e) {\n        return \'{}\';\n    }\n}',
    detail: '分类列表接口',
  },
  {
    label: 'async function detail(ids)',
    kind: 'Snippet',
    insertText:
      'async function detail(ids) {\n    try {\n        const id = String(ids);\n        const resp = await req(HOST + \'${1:/detail?id=}\' + id);\n        const d = JSON.parse(resp.content);\n        const eps = (d.episodes || []).map(e => e.name + \'$\' + e.url).join(\'#\');\n        return JSON.stringify({\n            list: [{\n                vod_id: id,\n                vod_name: d.name || \'\',\n                vod_pic: d.pic || \'\',\n                vod_year: d.year || \'\',\n                vod_area: d.area || \'\',\n                vod_director: d.director || \'\',\n                vod_actor: d.actor || \'\',\n                vod_content: d.desc || \'\',\n                vod_play_from: \'线路1\',\n                vod_play_url: eps\n            }]\n        });\n    } catch (e) {\n        return \'{}\';\n    }\n}',
    detail: '详情页接口',
  },
  {
    label: 'async function play(flag, id, flags)',
    kind: 'Snippet',
    insertText:
      'async function play(flag, id, flags) {\n    try {\n        return JSON.stringify({ parse: 0, url: id });\n    } catch (e) {\n        return \'{}\';\n    }\n}',
    detail: '播放解析接口',
  },
  {
    label: 'async function search(wd, quick, pg)',
    kind: 'Snippet',
    insertText:
      'async function search(wd, quick, pg) {\n    try {\n        const url = HOST + \'${1:/search?wd=}\' + encodeURIComponent(wd) + \'&pg=\' + (pg || \'1\');\n        const resp = await req(url);\n        const data = JSON.parse(resp.content);\n        const list = (data.list || []).map(it => ({\n            vod_id: it.id,\n            vod_name: it.name,\n            vod_pic: it.pic || \'\',\n            vod_remarks: it.remarks || \'\'\n        }));\n        return JSON.stringify({ list });\n    } catch (e) {\n        return \'{}\';\n    }\n}',
    detail: '搜索接口',
  },
  {
    label: 'http(url, options)',
    kind: 'Function',
    insertText: 'await http(${1:url}${2:, { headers: { \'User-Agent\': \'...\' } }})',
    detail: 'HTTP 请求（真实 http.js 的 http，异步返回 Promise）',
    doc: '与 req 等价。opt 支持 {method, headers, body, ua, async, complete}。返回对象含 .content/.code/.json()/.html()。',
  },
  {
    label: 'gbkTool()',
    kind: 'Function',
    insertText: 'const gbk = gbkTool();\nconst enc = gbk.encode(${1:\'中文\'});\nconst dec = gbk.decode(${2:enc});',
    detail: 'GBK 编解码（assets://js/lib/gbk.js）',
    doc: '返回 {encode(str)->percent编码, decode(str)->中文}。来源：import { gbkTool } from \'assets://js/lib/gbk.js\'。',
  },
  {
    label: 'compareTwoStrings(a, b)',
    kind: 'Function',
    insertText: 'compareTwoStrings(${1:a}, ${2:b})',
    detail: '字符串相似度 0~1（assets://js/lib/similarity.js）',
    doc: '基于 bigram 的 Dice 系数。来源：import { compareTwoStrings } from \'assets://js/lib/similarity.js\'。',
  },
  {
    label: 'findBestMatch(main, targets)',
    kind: 'Function',
    insertText: 'findBestMatch(${1:main}, ${2:[...]})',
    detail: '从候选里找最相似（assets://js/lib/similarity.js）',
    doc: '返回 {bestMatch:{target,rating}, bestMatchIndex, ratings[]}。来源：import { findBestMatch } from \'assets://js/lib/similarity.js\'。',
  },
  {
    label: 'cheerio.load(html)',
    kind: 'Function',
    insertText: 'const $ = cheerio.load(${1:html});\n$(\'${2:selector}\').each((i, el) => {\n    const t = $(el).text();\n    const h = $(el).attr(\'${3:href}\');\n});',
    detail: 'jQuery 风格 DOM 解析（assets://js/lib/cheerio.min.js）',
    doc: 'import cheerio from \'assets://js/lib/cheerio.min.js\' 或 import { load } from \'assets://js/lib/cheerio.min.js\'。支持选择器/text()/attr()/each() 等。',
  },
  {
    label: 'export function __jsEvalReturn()',
    kind: 'Snippet',
    insertText:
      'export function __jsEvalReturn() {\n    return { init, home, homeVod, category, detail, play, search };\n}',
    detail: '导出接口（必须）',
  },
];

// PY 源：base.spider 方法
const PY_SUGGESTIONS = [
  {
    label: 'self.fetch(url, headers, verify)',
    kind: 'Function',
    insertText: 'self.fetch(${1:url}, verify=False).text',
    detail: 'HTTP 请求，返回 Response(.text/.json())',
    doc: '参数: url, headers=dict, timeout=10, verify=False。返回对象含 .text/.content/.status_code/.json()。',
  },
  {
    label: 'self.json(content)',
    kind: 'Function',
    insertText: 'self.json(${1:content})',
    detail: '解析 JSON',
  },
  {
    label: 'self.html(content)',
    kind: 'Function',
    insertText: 'self.html(${1:content})',
    detail: 'HTML 解析（调试版原样返回）',
  },
  {
    label: 'self.pd(content, rule)',
    kind: 'Function',
    insertText: 'self.pd(${1:content}, \'${2:正则}\')',
    detail: '正则取第一个匹配',
  },
  {
    label: 'self.log(...)',
    kind: 'Function',
    insertText: 'self.log(${1:msg})',
    detail: '调试日志（显示在调试台日志页）',
  },
  {
    label: 'def homeContent(self, filter)',
    kind: 'Snippet',
    insertText:
      'def homeContent(self, filter):\n    classes = [\n        {\'type_id\': \'剧集\', \'type_name\': \'剧集\'},\n        {\'type_id\': \'电影\', \'type_name\': \'电影\'}\n    ]\n    return {\'class\': classes, \'filters\': {}}',
    detail: '首页分类',
  },
  {
    label: 'def homeVideoContent(self)',
    kind: 'Snippet',
    insertText:
      'def homeVideoContent(self):\n    try:\n        data = json.loads(self.fetch(self.host + \'${1:/home.json}\', verify=False).text)\n        videos = []\n        for it in data.get(\'list\', []):\n            videos.append({\'vod_id\': it.get(\'id\'), \'vod_name\': it.get(\'name\'), \'vod_pic\': it.get(\'pic\', \'\')})\n        return {\'list\': videos}\n    except Exception:\n        return None',
    detail: '首页推荐',
  },
  {
    label: 'def categoryContent(self, tid, pg, filter, ext)',
    kind: 'Snippet',
    insertText:
      'def categoryContent(self, tid, pg, filter, ext):\n    try:\n        url = self.host + \'${1:/list?tid=}\' + str(tid) + \'&pg=\' + str(pg)\n        data = json.loads(self.fetch(url, verify=False).text)\n        videos = []\n        for it in data.get(\'list\', []):\n            videos.append({\n                \'vod_id\': it.get(\'id\'),\n                \'vod_name\': it.get(\'name\'),\n                \'vod_pic\': it.get(\'pic\', \'\'),\n                \'vod_remarks\': it.get(\'remarks\', \'\')\n            })\n        return {\'list\': videos, \'page\': pg, \'pagecount\': data.get(\'pagecount\', 999)}\n    except Exception:\n        return None',
    detail: '分类列表',
  },
  {
    label: 'def detailContent(self, ids)',
    kind: 'Snippet',
    insertText:
      'def detailContent(self, ids):\n    try:\n        vid = str(ids[0])\n        if \'#\' in vid:\n            vid = vid.split(\'#\')[0]\n        url = self.host + \'${1:/detail?id=}\' + vid\n        d = json.loads(self.fetch(url, verify=False).text)\n        eps = \'#\'.join([str(e.get(\'name\')) + \'$\' + str(e.get(\'url\')) for e in d.get(\'episodes\', [])])\n        return {\'list\': [{\n            \'vod_id\': vid, \'vod_name\': d.get(\'name\', \'\'), \'vod_pic\': d.get(\'pic\', \'\'),\n            \'vod_year\': d.get(\'year\', \'\'), \'vod_area\': d.get(\'area\', \'\'),\n            \'vod_director\': d.get(\'director\', \'\'), \'vod_actor\': d.get(\'actor\', \'\'),\n            \'vod_content\': d.get(\'desc\', \'\'), \'vod_play_from\': \'线路1\', \'vod_play_url\': eps\n        }]}\n    except Exception:\n        return None',
    detail: '详情页',
  },
  {
    label: 'def searchContent(self, key, quick, pg)',
    kind: 'Snippet',
    insertText:
      'def searchContent(self, key, quick, pg=\'1\'):\n    try:\n        from urllib.parse import quote\n        url = self.host + \'${1:/search?wd=}\' + quote(key) + \'&pg=\' + str(pg)\n        data = json.loads(self.fetch(url, verify=False).text)\n        videos = []\n        for it in data.get(\'list\', []):\n            videos.append({\'vod_id\': it.get(\'id\'), \'vod_name\': it.get(\'name\'), \'vod_pic\': it.get(\'pic\', \'\')})\n        return {\'list\': videos, \'page\': pg}\n    except Exception:\n        return None',
    detail: '搜索',
  },
  {
    label: 'def playerContent(self, flag, id, vipflags)',
    kind: 'Snippet',
    insertText:
      'def playerContent(self, flag, id, vipflags):\n    return {\'jx\': \'0\', \'parse\': \'0\', \'url\': id}',
    detail: '播放解析',
  },
];

let monacoReady = false;
const pendingCallbacks = [];

function initMonaco(cb) {
  if (monacoReady) return cb(monaco);
  pendingCallbacks.push(cb);
  require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' } });
  require(['vs/editor/editor.main'], function () {
    monacoReady = true;
    registerCompletions();
    pendingCallbacks.splice(0).forEach((c) => c(monaco));
  });
}

function registerCompletions() {
  // JS 补全
  monaco.languages.registerCompletionItemProvider('javascript', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const items = JS_SUGGESTIONS.map((s) => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind[s.kind] || monaco.languages.CompletionItemKind.Function,
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: s.detail,
        documentation: s.doc ? { value: s.doc } : undefined,
        range,
      }));
      return { suggestions: items };
    },
  });
  // PY 补全
  monaco.languages.registerCompletionItemProvider('python', {
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const items = PY_SUGGESTIONS.map((s) => ({
        label: s.label,
        kind: monaco.languages.CompletionItemKind[s.kind] || monaco.languages.CompletionItemKind.Function,
        insertText: s.insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: s.detail,
        documentation: s.doc ? { value: s.doc } : undefined,
        range,
      }));
      return { suggestions: items };
    },
  });
}
