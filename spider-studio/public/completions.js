/**
 * Monaco 自动补全：TVBox 猫源 API
 */
'use strict';

// JS 源：QuickJS 内置函数 + cat.js + 接口骨架
const JS_SUGGESTIONS = [
  {
    label: 'init(ext)',
    kind: 'Function',
    insertText: 'async function init(ext) {\n    // ext 为扩展参数对象（调试台填写），如 { host, appid, versionCode }\n    ${1}\n}',
    detail: '源初始化（可选，读取 ext 参数）',
    doc: 'TVBox 在首次加载源时调用，用于解析 ext 扩展参数（JSON 字符串）。常见的动态源会在此把参数保存到 local 供后续方法使用。示例：\nconst { host, appid } = JSON.parse(ext);\nlocal.set(\'host\', host);',
  },
  {
    label: 'req(url, opt)',
    kind: 'Function',
    insertText: 'await req(${1:url}${2:, { headers: { \'User-Agent\': \'...\' } }})',
    detail: 'HTTP 请求，返回 {content, code, json(), html()}',
    doc: '发起 HTTP 请求。opt 支持：{method, headers, body, postType, data, ua, redirect}。\n- postType=\'form\' 时自动将 data 对象转为 URLSearchParams 并设为 body\n- data 为对象时自动序列化，为字符串时直接作为 body\n- 返回对象含 .content(文本)、.json()、.html()、.code。',
  },
  {
    label: 'aesX(mode, encrypt, input, inBase64, key, iv, outBase64)',
    kind: 'Function',
    insertText: 'aesX(\'AES/CBC/PKCS7Padding\', ${1:false}, ${2:data}, ${3:true}, ${4:key}, ${5:iv}, ${6:true})',
    detail: 'AES 加解密（FongMi 标准签名）',
    doc: 'mode: AES/CBC/PKCS7Padding、AES/ECB/No 等；encrypt=true 加密、false 解密；inBase64 表示输入是否 base64；iv 在 ECB 时传 null；outBase64 默认同 inBase64。',
  },
  {
    label: 'desX(mode, encrypt, input, inBase64, key, iv, outBase64)',
    kind: 'Function',
    insertText: 'desX(\'DESede/CBC/PKCS7Padding\', ${1:false}, ${2:data}, ${3:true}, ${4:key}, ${5:iv}, ${6:false})',
    detail: '3DES 加解密（FongMi 标准签名）',
    doc: 'mode: DESede/CBC/PKCS7Padding 等；encrypt=true 加密、false 解密；inBase64 表示输入是否 base64；iv 在 ECB 时传 null。',
  },
  {
    label: 'joinUrl(parent, child)',
    kind: 'Function',
    insertText: 'joinUrl(${1:parent}, ${2:child})',
    detail: 'URL 拼接',
    doc: '若 child 为绝对地址（含 scheme 或 //）则直接返回，否则基于 parent 拼接。',
  },
  {
    label: 'rsaX(mode, pub, encrypt, input, inBase64, key, outBase64)',
    kind: 'Function',
    insertText: 'rsaX(\'RSA/PKCS1\', ${1:true}, ${2:true}, ${3:data}, ${4:true}, ${5:key}, ${6:true})',
    detail: 'RSA 加解密',
    doc: 'mode: RSA/PKCS1 或 RSA/None/NoPadding；pub=true 公钥、false 私钥；encrypt=true 加密、false 解密；inBase64 输入是否 base64；key 支持 PEM 或裸 base64。',
  },
  {
    label: 'md5X(str)',
    kind: 'Function',
    insertText: 'md5X(${1:str})',
    detail: 'MD5 十六进制哈希',
    doc: '返回小写 hex MD5。',
  },
  {
    label: 'MD5(str)',
    kind: 'Function',
    insertText: 'MD5(${1:str}).toString()',
    detail: 'MD5 哈希（cat.js 的 Crypto.MD5）',
    doc: '等价于 md5X，来自 assets://js/lib/cat.js 的 CryptoJS。',
  },
  {
    label: 'json(content)',
    kind: 'Function',
    insertText: 'JSON.parse(${1:content})',
    detail: '解析 JSON 字符串',
    doc: '全局 json() 等价于 JSON.parse；调试台也可直接用 JSON.parse。',
  },
  {
    label: 'html(content)',
    kind: 'Function',
    insertText: '${1:content}',
    detail: 'HTML 内容（调试版原样返回）',
    doc: '全局 html() 在真机上用于解析 HTML，调试环境原样返回字符串。',
  },
  {
    label: 'local.get(key, def)',
    kind: 'Function',
    insertText: 'local.get(${1:\'key\'}${2:, ${3:default}});',
    detail: '读取本机 KV 存储（按源文件隔离）',
    doc: '模拟真机 QuickJS 的本地存储，按源文件隔离命名空间。local.get(\'k\', def) 取值，不存在时返回 def。',
  },
  {
    label: 'local.set(key, value)',
    kind: 'Function',
    insertText: 'local.set(${1:\'key\'}, ${2:value});',
    detail: '写入本机 KV 存储（按源文件隔离）',
    doc: '跨调试请求持久化（如 deviceid、host 等）。local.set(\'k\', v)。',
  },
  {
    label: 'importJs(name)',
    kind: 'Function',
    insertText: 'importJs(${1:\'assets://js/lib/cat.js\'});',
    detail: '加载额外 JS 库',
    doc: '调试环境仅记录日志，不实际执行。真机上用于按需加载依赖库。',
  },
  {
    label: 'debugLog(...args)',
    kind: 'Function',
    insertText: 'debugLog(${1:msg});',
    detail: '调试日志（显示在调试台日志页）',
    doc: '输出到调试台日志页，带 [debug] 前缀，与 console.log 效果类似。',
  },
  {
    label: 'getProxy(local)',
    kind: 'Function',
    insertText: 'getProxy(${1:false})',
    detail: '返回本地代理地址',
    doc: 'local=true 返回 127.0.0.1，否则返回默认代理地址。',
  },
  {
    label: 'js2Proxy(dynamic, siteType, siteKey, url, headers)',
    kind: 'Function',
    insertText: 'js2Proxy(${1:true}, ${2:\'嗅探\'}, ${3:\'key\'}, ${4:url}, ${5:{}})',
    detail: '返回播放代理地址',
    doc: 'dynamic=是否动态源，siteType=站点类型，siteKey=站点标识，url=播放地址，headers=自定义请求头。',
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
    label: 'base64.b64encode(buf)',
    kind: 'Function',
    insertText: 'base64.b64encode(${1:buffer})',
    detail: '字节缓冲区转 Base64',
  },
  {
    label: 'base64.b64decode(str)',
    kind: 'Function',
    insertText: 'base64.b64decode(${1:str})',
    detail: 'Base64 转字节缓冲区',
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
    doc: '返回所有匹配结果数组，规则形如 正则 或 正则&&拼接URL前缀。',
  },
  {
    label: 'pdyh(html, rule)',
    kind: 'Function',
    insertText: 'pdyh(${1:html}, \'${2:规则}\')',
    detail: '取第一个匹配（自动补全相对地址）',
    doc: '与 pdfh 类似，返回第一个匹配结果。',
  },
  {
    label: 'pdfl(html, rule)',
    kind: 'Function',
    insertText: 'pdfl(${1:html}, \'${2:规则}\')',
    detail: '取列表（同 pdfa）',
    doc: '返回匹配列表数组，通常配合 pdfh/pd 使用。',
  },
  {
    label: 'Crypto.enc.Base64.parse(str)',
    kind: 'Function',
    insertText: 'Crypto.enc.Base64.parse(${1:str})',
    detail: 'Base64 字符串转为 WordArray',
    doc: '来自 assets://js/lib/cat.js 的 CryptoJS。',
  },
  {
    label: 'Crypto.enc.Utf8.stringify(wa)',
    kind: 'Function',
    insertText: 'Crypto.enc.Utf8.stringify(${1:wordArray})',
    detail: 'WordArray 转为 UTF8 字符串',
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
    detail: 'MD5 哈希',
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
    doc: '与 req 等价。opt 支持 {method, headers, body, postType, data, ua, async, complete}。postType=\'form\' 时 data 对象自动转为 URLSearchParams。返回对象含 .content/.code/.json()/.html()。',
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
    registerJsTypes();
    registerHoverProviders();
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

// ============ JS 全局类型声明（让悬停显示签名而非裸 any） ============
// 由补全项自动生成 declare function / declare const，注入 JS 语言服务，
// 使 req / aesX / joinUrl 等全局函数在悬停时显示正确签名。
function buildJsDeclarations() {
  const funcs = []; // 顶层函数
  const objMethods = {}; // 对象 -> 方法列表（如 base64.encode）
  for (const s of JS_SUGGESTIONS) {
    const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(([^)]*)\)$/.exec(s.label);
    if (!m) continue;
    const full = m[1];
    const params = m[2]
      .split(',')
      .map((p) => p.trim().replace(/^\.\.\./, ''))
      .filter(Boolean);
    const sig = '(' + params.map((p) => p + ': any').join(', ') + '): any';
    const dot = full.indexOf('.');
    if (dot === -1) {
      funcs.push('declare function ' + full + sig + ';');
    } else {
      const obj = full.slice(0, dot);
      const method = full.slice(dot + 1);
      (objMethods[obj] = objMethods[obj] || []).push(method + sig);
    }
  }
  const lines = funcs.slice();
  for (const obj of Object.keys(objMethods)) {
    lines.push('declare const ' + obj + ': { ' + objMethods[obj].join('; ') + ' };');
  }
  return lines.join('\n');
}

function registerJsTypes() {
  try {
    monaco.languages.typescript.javascriptDefaults.addExtraLib(buildJsDeclarations(), 'tvbox-globals.d.ts');
  } catch (e) {
    // 语言服务不可用则忽略
  }
}

// ============ 悬停提示（Hover）：显示中文说明而非 only any ============
function buildHoverMap(list) {
  const map = {};
  for (const s of list) {
    const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)/.exec(s.label);
    if (!m) continue;
    const name = m[1];
    if (!map[name]) map[name] = { label: s.label, detail: s.detail || '', doc: s.doc || '' };
  }
  return map;
}

function registerHoverProviders() {
  const jsHover = buildHoverMap(JS_SUGGESTIONS);
  const pyHover = buildHoverMap(PY_SUGGESTIONS);
  const mk = (map) => (model, position) => {
    const word = model.getWordAtPosition(position);
    if (!word) return null;
    // 支持 base64.encode 这类带点的完整名
    const line = model.getLineContent(position.lineNumber);
    const before = line.slice(0, position.column - 1);
    const m = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)$/.exec(before);
    const name = (m && m[1]) || word.word;
    const info = map[name];
    if (!info) return null;
    const contents = [{ value: '```\n' + info.label + '\n```' }];
    if (info.detail) contents.push({ value: info.detail });
    if (info.doc) contents.push({ value: info.doc.replace(/\n/g, '  \n') });
    return {
      contents,
      range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
    };
  };
  monaco.languages.registerHoverProvider('javascript', { provideHover: mk(jsHover) });
  monaco.languages.registerHoverProvider('python', { provideHover: mk(pyHover) });
}
