/**
 * JS 源 mock 运行时
 *
 * 在 Node 中尽量还原 FongMi/TV 猫源 QuickJS 环境：
 *   - 直接复用 fongmi-tv-js/lib 里从 TV apk 提取的真实运行时文件：
 *     cat.js / cheerio.min.js / gbk.js / similarity.js / http.js
 *   - 注入 req / http / aesX / md5X / sniff / base64 / pd / pdfh / pdfa / pdyh / pdfl / json / html 等全局函数
 *   - http.js 底层依赖的真机原生 _http 用 Node fetch 模拟
 *   - 把源码的 ESM import/export 改写为 CommonJS 风格后，在 vm 上下文中执行
 *   - 支持 __jsEvalReturn 导出，以及直接按函数名查找
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ============ 真实 lib（从 TV apk 提取） ============
// fongmi-tv-js/lib/ 是 TVBox 猫源运行时的真实工具库：
//   cat.js          -> Crypto / dayjs / cheerio / _ / jp / Uri / load / parseHTML ...
//   cheerio.min.js  -> load(default) / parseHTML / html / merge / contains ...
//   gbk.js          -> gbkTool() 工厂（返回 encode/decode）
//   similarity.js   -> compareTwoStrings / findBestMatch / findBestLCS
//   http.js         -> http / req（依赖真机原生 _http，由 mock 提供）
// 调试时直接复用它们，保证与真机行为一致。
const LIBS_DIR = path.join(__dirname, '..', '..', 'fongmi-tv-js', 'lib');
const REAL_LIBS = {
  cat: path.join(LIBS_DIR, 'cat.js'),
  cheerio: path.join(LIBS_DIR, 'cheerio.min.js'),
  gbk: path.join(LIBS_DIR, 'gbk.js'),
  similarity: path.join(LIBS_DIR, 'similarity.js'),
  http: path.join(LIBS_DIR, 'http.js'),
};

const _libCache = {}; // 模块级缓存：每个文件只解析一次

// 模拟真机 QuickJS 的 local KV 存储：按源文件路径隔离命名空间，可跨调试请求持久化（如 deviceid）
const _localStore = {}; // sourcePath -> { key: value }

// 通用：把 ESM 文件的 `export{...};`（含 `export function xx`）改写为挂到 globalThis，再在独立 context 执行
// exportClause 非空时直接替换末尾的 export{...}; 否则在源码末尾追加赋值语句
function loadEsmLib(name) {
  if (_libCache[name]) return _libCache[name];
  let code = fs.readFileSync(REAL_LIBS[name], 'utf-8');

  if (name === 'http') {
    // http.js 无 export，且依赖全局 _http（真机原生）。末尾追加把 http/req 挂到全局。
    code += '\nglobalThis.__http_req = req;\nglobalThis.__http_http = http;';
  } else {
    // 内嵌的 `export function/const/... ` 改写为普通声明（vm 非 module 上下文不允许 export 语句）
    code = code.replace(/^\s*export\s+(function|const|let|var|class)\s+/gm, '$1 ');
    // 把末尾 `export{...};` 改写为 `globalThis.__lib_exports__={...};`
    const m = /export\{([\s\S]*?)\};?\s*$/.exec(code);
    if (m) {
      const names = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const lines = names.map((alias) => {
        const mm = /^(\w+)\s+as\s+(\w+)$/.exec(alias);
        if (mm) return `${mm[2]}: ${mm[1]},`;
        return `${alias}: ${alias},`;
      });
      code = code.slice(0, m.index) + `globalThis.__lib_exports__ = { ${lines.join('')} };`;
    } else {
      // 无 export{...} 的文件（gbk.js）在末尾收集已改写的顶层导出
      code += '\nglobalThis.__lib_exports__ = globalThis.__lib_exports__ || {};';
      code += '\nfor (const k of ["gbkTool"]) { if (typeof globalThis[k] !== "undefined") globalThis.__lib_exports__[k] = globalThis[k]; }';
    }
  }

  const sandbox = { console, globalThis: null, self: null, window: null };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { timeout: 60000 });
  _libCache[name] = {
    exports: sandbox.__lib_exports__ || {},
    httpReq: sandbox.__http_req,
    httpHttp: sandbox.__http_http,
    sandbox, // http.js 需要保留，用于每次注入不同的 _http mock
  };
  return _libCache[name];
}

// ============ ESM -> CommonJS 改写 ============
// 处理:  import { Crypto } from 'assets://js/lib/cat.js';
//        export function xxx() ...
//        export { a, b };
//        export default ...
function transformSource(code) {
  let out = code;
  // 1. import { A as B, C } from 'assets://js/lib/cat.js'  ->  const B = __tvbox_A; const C = __tvbox_C;
  out = out.replace(
    /^\s*import\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"];?\s*$/gm,
    (m, names) => {
      const lines = names
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((n) => {
          const parts = n.split(/\s+as\s+/);
          const src = parts[0].trim();
          const local = (parts[1] || src).trim();
          return `const ${local} = globalThis.__tvbox_${src};`;
        });
      return lines.join('\n');
    }
  );
  // 2. import * as X from 'assets://js/lib/xxx.js'  ->  构建命名空间对象（从 __tvbox_* 收集）
  out = out.replace(
    /^\s*import\s*\*\s+as\s+(\w+)\s+from\s*['"][^'"]+['"];?\s*$/gm,
    (m, ns) => {
      const names = [
        'Crypto','Uri','_','cheerio','contains','dayjs','html','jinja2','jp','jpo',
        'load','merge','parseHTML','root','text','xml','gbkTool',
        'compareTwoStrings','findBestMatch','findBestLCS',
      ];
      const assign = names.map((n) => `"${n}": globalThis.__tvbox_${n}`).join(',');
      return `const ${ns} = { ${assign} };`;
    }
  );
  // 2b. default 导入: import X from 'assets://js/lib/cheerio.min.js' 等
  //     cheerio.min.js 的 default 即 load；其他 lib 的 default 兜底取同名导出
  out = out.replace(
    /^\s*import\s+(\w+)\s+from\s*['"]([^'"]+)['"];?\s*$/gm,
    (m, local, spec) => {
      const base = String(spec).split('/').pop().replace(/\.min\.js$/i, '').replace(/\.js$/i, '');
      if (/cheerio/i.test(base)) {
        return `const ${local} = globalThis.__tvbox_cheerio;`;
      }
      // 其他 default 导入：尝试从 cat.js 已知导出里找同名
      return `const ${local} = globalThis.__tvbox_${base} || globalThis.__tvbox_${local};`;
    }
  );
  // 3. 其他 import（default / 具名带路径）统一去掉，避免语法错误
  out = out.replace(/^\s*import\s+[^'"]+?from\s*['"][^'"]+['"];?\s*$/gm, '');
  out = out.replace(/^\s*import\s*['"][^'"]+['"];?\s*$/gm, '');
  // 4. 去掉 export 关键字
  out = out.replace(/^\s*export\s+(function|const|let|var|class)\s+/gm, '$1 ');
  out = out.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');
  out = out.replace(/^\s*export\s+default\s+/gm, '');
  return out;
}

// ============ 简单 jsoup 风格解析（正则版） ============
// 规则格式支持: "正则" | "正则&&前缀拼接" | "jsoupSelector@attr"（简化：只做正则）
function matchRule(content, rule, addUrl) {
  if (!rule) return '';
  let base = '';
  let reStr = rule;
  // 支持 a&&b 拼接（jsoup 风格: 取 base url + 相对地址）
  if (rule.indexOf('&&') > -1) {
    const segs = rule.split('&&');
    reStr = segs[0];
    const m = /^https?:\/\/[^/]+/.exec(segs[1] || '');
    if (m) base = m[0];
  }
  // jsoup 选择器规则（含 @text/@href/@src）转成正则近似 —— 只处理最简单的 href/src 抓取
  if (/@(href|src|data-src|data-original)/.test(reStr)) {
    const attr = /@([a-zA-Z-]+)/.exec(reStr)[1];
    const pre = reStr.split('@')[0];
    const pat = new RegExp('<[^>]*' + pre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^>]*' + attr + '=["\']([^"\']+)["\']', 'i');
    const m2 = content.match(pat);
    const val = m2 ? m2[1] : '';
    return formatUrl(val, base);
  }
  try {
    const re = new RegExp(reStr, 'i');
    const m = content.match(re);
    let val = '';
    if (m) {
      val = m.length > 1 ? m[1] : m[0];
    }
    return formatUrl(val, base);
  } catch (e) {
    return '';
  }
}

function formatUrl(url, base) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (base && url.startsWith('/')) return base + url;
  if (base && !/^[a-z]+:/i.test(url)) return base + '/' + url.replace(/^\/+/, '');
  return url;
}

// ============ 构建沙箱 ============
function buildSandbox({ logs, requests, sourcePath }) {
  // 加载真实 lib（从 TV apk 提取的 TVBox 工具库）
  let catExports, cheerioExports, gbkExports, simExports, httpLib;
  try {
    catExports = loadEsmLib('cat').exports;
  } catch (e) {
    logs.push('[cat.js] 加载失败: ' + e.message);
    catExports = {};
  }
  try {
    cheerioExports = loadEsmLib('cheerio').exports;
  } catch (e) {
    logs.push('[cheerio.min.js] 加载失败: ' + e.message);
    cheerioExports = {};
  }
  try {
    gbkExports = loadEsmLib('gbk').exports;
  } catch (e) {
    logs.push('[gbk.js] 加载失败: ' + e.message);
    gbkExports = {};
  }
  try {
    simExports = loadEsmLib('similarity').exports;
  } catch (e) {
    logs.push('[similarity.js] 加载失败: ' + e.message);
    simExports = {};
  }
  try {
    httpLib = loadEsmLib('http');
  } catch (e) {
    logs.push('[http.js] 加载失败: ' + e.message);
    httpLib = null;
  }

  // 日志
  const consoleCapture = {
    log: (...a) => logs.push('[log] ' + a.map(String).join(' ')),
    info: (...a) => logs.push('[info] ' + a.map(String).join(' ')),
    warn: (...a) => logs.push('[warn] ' + a.map(String).join(' ')),
    error: (...a) => logs.push('[error] ' + a.map(String).join(' ')),
    debug: (...a) => logs.push('[debug] ' + a.map(String).join(' ')),
    table: (...a) => logs.push('[table] ' + a.map(JSON.stringify).join(' ')),
  };

  // 请求记录
  const record = (url, opt, resp) => {
    requests.push({
      url,
      method: (opt && opt.method) || (opt && opt.body ? 'POST' : 'GET'),
      headers: (opt && opt.headers) || {},
      status: resp ? resp.code : null,
      size: resp && resp.content ? resp.content.length : 0,
      time: new Date().toLocaleTimeString(),
    });
  };

  // ===== 模拟真机原生 _http（http.js 的 http/req 底层依赖它） =====
  // 真机上 _http(url, options) 同步返回 Response 或异步回调 complete；这里用 Node fetch 实现。
  async function nativeHttp(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (options.ua && !headers['User-Agent']) headers['User-Agent'] = options.ua;
    if (!headers['User-Agent']) headers['User-Agent'] = 'Mozilla/5.0 (TVBox Spider Studio)';
    const method = (options.method || (options.body ? 'POST' : 'GET')).toUpperCase();
    let body = options.body;
    // 兼容猫源约定的 postType='form' 的 data 字段（真机原生 _http 支持，Node fetch 需转成 body）
    if (options.data != null) {
      if (options.postType === 'form' || options.postType === 'data') {
        body = new URLSearchParams(options.data).toString();
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        body = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
      }
    }
    if (body && typeof body !== 'string' && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
    let respObj;
    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: body || undefined,
        redirect: options.redirect === false ? 'manual' : 'follow',
      });
      const text = await resp.text();
      respObj = {
        content: text,
        code: resp.status,
        statusCode: resp.status,
        url: resp.url || url,
        headers: Object.fromEntries(resp.headers.entries()),
        // 兼容 FongMi cat 的 resp.json() / resp.html()
        json: () => JSON.parse(text),
        html: () => text,
        text: () => text,
        get cookies() {
          return Object.fromEntries(resp.headers.entries());
        },
      };
      record(url, options, respObj);
    } catch (e) {
      logs.push('[req-error] ' + url + ' => ' + e.message);
      record(url, options, { code: 0, content: '' });
      respObj = {
        content: '',
        code: 0,
        url,
        headers: {},
        json: () => null,
        html: () => '',
        text: () => '',
      };
    }
    // 真机 _http 若传了 complete 回调则调用它；否则同步返回（Node 里以 Promise 模拟，await req 可用）
    if (typeof options.complete === 'function') {
      options.complete(respObj);
    }
    return respObj;
  }

  // 把 mock _http 注入到缓存的 http.js 沙箱，使其 http/req 每次使用当前运行的请求记录
  if (httpLib) {
    httpLib.sandbox._http = nativeHttp;
  }

  // 暴露给源码的 req/http：优先用真实 http.js 的，失败则回退到 nativeHttp
  const req = httpLib && httpLib.httpReq ? httpLib.httpReq : nativeHttp;
  const http = httpLib && httpLib.httpHttp ? httpLib.httpHttp : nativeHttp;

  // aesX：还原 FongMi cat 的 AES 封装（基于真实 cat.js 的 Crypto）
  // 参数: aesX(mode, inBase64, data, isBase64, key, outBase64, isNoPadding)
  const CatCrypto = catExports.Crypto || {};
  function aesX(mode, inBase64, data, isBase64, key, outBase64, isNoPadding) {
    if (outBase64 === undefined || outBase64 === null) outBase64 = inBase64;
    const m = /^([A-Z0-9]+)\/([A-Z0-9]+)\/(.*)$/i.exec(String(mode));
    const algo = (m && m[1].toUpperCase()) || 'AES';
    const transform = (m && m[2].toUpperCase()) || 'ECB';
    const paddingName = m && m[3];
    let padding = CatCrypto.pad.Pkcs7;
    if (/No/i.test(paddingName || '')) padding = CatCrypto.pad.NoPadding;
    if (/Zero/i.test(paddingName || '')) padding = CatCrypto.pad.ZeroPadding;
    if (/PKCS5/i.test(paddingName || '')) padding = CatCrypto.pad.Pkcs7;

    // 解析 key / 输入
    const keyWA = isBase64 ? CatCrypto.enc.Base64.parse(String(key)) : CatCrypto.enc.Utf8.parse(String(key));
    let dataWA;
    if (inBase64) dataWA = CatCrypto.enc.Base64.parse(String(data));
    else dataWA = CatCrypto.enc.Utf8.parse(String(data));

    const modeObj = transform === 'CBC' ? CatCrypto.mode.CBC : CatCrypto.mode.ECB;

    let result;
    if (inBase64) {
      // 解密
      const cipherParams = CatCrypto.lib.CipherParams.create({ ciphertext: dataWA });
      const dec = CatCrypto.AES.decrypt(cipherParams, keyWA, { mode: modeObj, padding });
      result = dec;
    } else {
      // 加密
      const enc = CatCrypto.AES.encrypt(dataWA, keyWA, { mode: modeObj, padding });
      result = enc.ciphertext;
    }
    // 输出
    if (outBase64) {
      return CatCrypto.enc.Base64.stringify(result);
    }
    return CatCrypto.enc.Utf8.stringify(result);
  }

  function md5X(str) {
    return CatCrypto.MD5(String(str)).toString();
  }

  // desX：还原 FongMi cat 的 3DES 封装（与 aesX 同签名）
  // 参数: desX(mode, inBase64, data, isBase64, key, outBase64, isNoPadding)
  // mode 形如 "DESede/CBC/PKCS7Padding"（DESEDE=3DES），inBase64=true 表示 data 为 base64 密文（解密）
  function desX(mode, inBase64, data, isBase64, key, outBase64, isNoPadding) {
    if (outBase64 === undefined || outBase64 === null) outBase64 = inBase64;
    const m = /^([A-Z0-9]+)\/([A-Z0-9]+)\/(.*)$/i.exec(String(mode));
    const algo = ((m && m[1]) || 'DESEDE').toUpperCase();
    const transform = ((m && m[2]) || 'ECB').toUpperCase();
    const paddingName = m && m[3];
    let padding = CatCrypto.pad.Pkcs7;
    if (/No/i.test(paddingName || '')) padding = CatCrypto.pad.NoPadding;
    if (/Zero/i.test(paddingName || '')) padding = CatCrypto.pad.ZeroPadding;

    const cipher = /DESEDE/i.test(algo) ? CatCrypto.TripleDES : CatCrypto.DES;
    const keyWA = isBase64 ? CatCrypto.enc.Base64.parse(String(key)) : CatCrypto.enc.Utf8.parse(String(key));
    let dataWA;
    if (inBase64) dataWA = CatCrypto.enc.Base64.parse(String(data));
    else dataWA = CatCrypto.enc.Utf8.parse(String(data));
    const modeObj = transform === 'CBC' ? CatCrypto.mode.CBC : CatCrypto.mode.ECB;

    let result;
    if (inBase64) {
      const cipherParams = CatCrypto.lib.CipherParams.create({ ciphertext: dataWA });
      result = cipher.decrypt(cipherParams, keyWA, { mode: modeObj, padding });
    } else {
      result = cipher.encrypt(dataWA, keyWA, { mode: modeObj, padding }).ciphertext;
    }
    if (outBase64) return CatCrypto.enc.Base64.stringify(result);
    return CatCrypto.enc.Utf8.stringify(result);
  }

  async function sniff(url) {
    logs.push('[sniff] ' + url + ' （调试环境返回原样）');
    return url;
  }

  const base64 = {
    encode: (s) => Buffer.from(String(s), 'utf-8').toString('base64'),
    decode: (s) => Buffer.from(String(s), 'base64').toString('utf-8'),
    b64decode: (s) => Buffer.from(String(s), 'base64'),
    b64encode: (b) => Buffer.from(b).toString('base64'),
  };

  function json(content) {
    return JSON.parse(content);
  }
  function html(content) {
    return content;
  }

  // 简化版解析助手
  function pd(content, rule, addUrl = true) {
    return matchRule(content, rule, addUrl);
  }
  function pdfh(content, rule, addUrl = true) {
    return matchRule(content, rule, addUrl);
  }
  function pdyh(content, rule, addUrl = true) {
    return matchRule(content, rule, addUrl);
  }
  function pdfa(content, rule, addUrl = true) {
    if (!rule) return [];
    const base = rule.indexOf('&&') > -1 ? /https?:\/\/[^/]+/.exec(rule.split('&&')[1])?.[0] : '';
    const reStr = rule.split('&&')[0];
    const re = new RegExp(reStr, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(content)) !== null) {
      const val = m.length > 1 ? m[1] : m[0];
      out.push(formatUrl(val, base));
    }
    return out;
  }
  function pdfl(...args) {
    return pdfa(...args);
  }

  function debugLog(...args) {
    logs.push('[debug] ' + args.map(String).join(' '));
  }

  // importJs：加载额外 JS（这里简化为记录）
  function importJs(name) {
    logs.push('[importJs] ' + name + ' （调试环境未实现，跳过）');
  }

  // 模拟真机 local KV 存储（按源文件隔离）
  const _ns = _localStore[sourcePath] || (_localStore[sourcePath] = {});
  const local = {
    get: (k, d) => (Object.prototype.hasOwnProperty.call(_ns, k) ? _ns[k] : d),
    set: (k, v) => { _ns[k] = v; },
  };

  // js2Proxy：真机返回播放代理地址；调试环境返回一个占位标记（实际播放 URL 由 play 直接给出）
  function js2Proxy(flag, siteType, siteKey, url, header) {
    return 'js2proxy://' + siteType + '/' + siteKey + '/' + url;
  }

  // 基本浏览器 API 兜底
  const sandbox = {
    console: consoleCapture,
    req,
    http,
    aesX,
    desX,
    md5X,
    MD5: CatCrypto.MD5 || md5X,
    sniff,
    base64,
    json,
    html,
    pd,
    pdfh,
    pdfa,
    pdyh,
    pdfl,
    debugLog,
    importJs,
    local,
    js2Proxy,
    getProxy: (p) => { logs.push('[getProxy] ' + p + ' （调试环境返回原样）'); return p; },
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    fetch,
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Buffer,
    globalThis: null, // 由 vm 填充
  };
  // 注入真实 lib 的导出，映射为 __tvbox_<name>（cat.js / cheerio.min.js / gbk.js / similarity.js）
  const allLibExports = Object.assign(
    {},
    catExports,
    cheerioExports,
    gbkExports,
    simExports
  );
  for (const k of Object.keys(allLibExports)) {
    sandbox['__tvbox_' + k] = allLibExports[k];
  }
  // cheerio.min.js 的 default 导出即 load 函数，另映射 __tvbox_cheerio 便于 import { cheerio }
  if (cheerioExports.default) {
    sandbox.__tvbox_cheerio = cheerioExports.default;
  }
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
  sandbox.XMLHttpRequest = null; // 未实现，置空避免误用
  sandbox.WebSocket = null;
  sandbox.process = undefined; // 隔离，防止访问宿主
  return sandbox;
}

// ============ 默认参数（按方法） ============
function defaultArgs(method, args) {
  if (args && typeof args === 'object' && Object.keys(args).length) return args;
  switch (method) {
    case 'home':
      return [true];
    case 'homeVod':
      return [];
    case 'category':
      return ['电影', '1', true, {}];
    case 'detail':
      return ['1'];
    case 'play':
      return ['在线播放', '1$1$0', []];
    case 'search':
      return ['猫', false, '1'];
    default:
      return [];
  }
}

// ============ 运行入口 ============
async function runJsSource({ path, method, args, ext, config }) {
  const logs = [];
  const requests = [];
  let source;
  try {
    source = fs.readFileSync(path, 'utf-8');
  } catch (e) {
    return { ok: false, error: '读取文件失败: ' + e.message, logs, requests };
  }

  let code;
  try {
    code = transformSource(source);
  } catch (e) {
    return { ok: false, error: '源码改写失败: ' + e.message, logs, requests };
  }

  const sandbox = buildSandbox({ logs, requests, sourcePath: path });
  try {
    vm.runInNewContext(code, sandbox, { timeout: 30000 });
  } catch (e) {
    return { ok: false, error: '语法/加载错误: ' + (e.stack || e.message), logs, requests };
  }

  // 导出接口
  let api = null;
  try {
    if (typeof sandbox.__jsEvalReturn === 'function') {
      api = sandbox.__jsEvalReturn();
    } else {
      api = {};
      for (const n of ['init', 'home', 'homeVod', 'category', 'detail', 'play', 'search']) {
        if (typeof sandbox[n] === 'function') api[n] = sandbox[n];
      }
    }
  } catch (e) {
    return { ok: false, error: '导出接口失败: ' + e.message, logs, requests };
  }

  if (!api || typeof api[method] !== 'function') {
    return {
      ok: false,
      error: `方法 ${method} 不存在。可用方法: ${Object.keys(api).join(', ')}`,
      logs,
      requests,
    };
  }

  // 自动 init
  if (method !== 'init' && typeof api.init === 'function') {
    try {
      const cfg = Object.assign({ skey: '', stype: 0, ext: ext || '{}' }, config || {});
      await api.init(cfg);
    } catch (e) {
      logs.push('[init-error] ' + (e.stack || e.message));
    }
  }

  const callArgs = method === 'init' ? [Object.assign({ skey: '', stype: 0, ext: ext || '{}' }, config || {})] : defaultArgs(method, args);

  let result;
  try {
    result = await api[method](...callArgs);
    logs.push(`[done] ${method}() 执行成功`);
  } catch (e) {
    return { ok: false, error: (e && e.stack) || String(e), logs, requests };
  }

  return { ok: true, method, result, logs, requests };
}

module.exports = { runJsSource, transformSource };
