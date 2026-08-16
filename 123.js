/**
 * 123 - TVBox 猫源 JS 爬虫（由 Spider Studio 生成）
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
let HOST = 'http://123.com';
// 扩展参数示例：{"key":"xxx","version":"1.0","host":"https://example.com"}
let EXT_DEFAULT = {};

// ============ 初始化 ============
async function init(cfg) {
    // cfg.skey: 站点key, cfg.stype: 站点类型, cfg.ext: 扩展参数(JSON字符串或对象)
    try {
        let ext = typeof cfg.ext === 'string' ? JSON.parse(cfg.ext) : (cfg.ext || {});
        if (ext.host) HOST = ext.host;
        else if (!HOST) HOST = 'http://123.com';
        console.log('[init] host =', HOST);
    } catch (e) {}
}

// ============ 首页分类 ============
async function home(filter) {
    const classes = [
    {
        "type_id": "剧集",
        "type_name": "剧集"
    },
    {
        "type_id": "电影",
        "type_name": "电影"
    },
    {
        "type_id": "综艺",
        "type_name": "综艺"
    },
    {
        "type_id": "动漫",
        "type_name": "动漫"
    }
];
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
