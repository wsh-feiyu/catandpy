/**
 * 火花影视 - TVBox 猫源 JS 爬虫
 *
 * ext 外部传入格式（JSON字符串）:
 *   {"key":"qvn1u7FCfu981olp980i8uVHVS8Dxih7","version":"2.7.0"}
 *   或指定host: {"key":"qvn1u7FCfu981olp980i8uVHVS8Dxih7","version":"2.7.0","host":"https://xxx"}
 *
 * 若ext中不含host，则自动从配置URL获取
 */

import { Crypto } from 'assets://js/lib/cat.js';

const AES_KEY = 'qvn1u7FCfu981olp980i8uVHVS8Dxih7';
let _key = AES_KEY;
let _version = '2.7.0';
let _host = '';
let _imgUrl = '';
let siteKey = '', siteType = 0;

// ============ 初始化 ============
async function init(cfg) {
    siteKey = cfg.skey;
    siteType = cfg.stype;
    try {
        let ext = typeof cfg.ext === 'string' ? JSON.parse(cfg.ext) : cfg.ext;
        _key = ext.key || AES_KEY;
        _version = ext.version || '2.7.0';
        _host = ext.host || '';

        if (!_host) {
            const dataurl = 'https://ss.trgfd.cn/cache/index/com.huohuavideo.app.json';
            const resp = await req(dataurl);
            const html = JSON.parse(resp.content);
            _host = html.app.textURL;
            _imgUrl = html.app.resourceURL || '';
        }
    } catch (e) {}
}

// ============ AES-GCM 解密 ============
// 密文格式：Base64( IV(12) + 密文 + tag(16) )
// GCM 的 CTR 密钥流 = AES-ECB 加密计数器块（key 为 UTF-8 32 字节），J0 = IV||1，密钥流从 inc32(J0)=IV||2 开始。
// 这里用 cat.js 的 Crypto（crypto-js）直接实现，不依赖 aesX（aesX 内部是 IvParameterSpec，不支持 GCM）。
function decrypt(data) {
    // 1. Base64 解码：IV(12) + 密文 + tag(16)
    const raw = Crypto.enc.Base64.parse(data);
    const totalBytes = raw.sigBytes;

    // 2. 密文字节数 = 总字节数 - IV(12) - tag(16)
    const cipherBytes = totalBytes - 28;

    // 3. 提取密文 word 数组（去掉 IV 的 3 个 word 和 tag 的 4 个 word）
    const cipherWords = raw.words.slice(3, raw.words.length - 4);

    // 4. key 按 UTF-8 解析（32 字节，AES-256）
    const keyWA = Crypto.enc.Utf8.parse(_key);

    // 5. CTR 解密：计数器从 2 开始（J0 = IV||1，密钥流从 inc32(J0) = IV||2 开始）
    const plainWords = [];
    for (let i = 0, counter = 2; i < cipherWords.length; i += 4, counter = (counter + 1) | 0) {
        // 计数器块 = IV(12字节) + counter(4字节大端序)
        const counterBlock = Crypto.lib.WordArray.create(
            [raw.words[0], raw.words[1], raw.words[2], counter], 16
        );
        // 用 AES-ECB 加密计数器块，得到密钥流块（NoPadding）
        const keystream = Crypto.AES.encrypt(counterBlock, keyWA, {
            mode: Crypto.mode.ECB,
            padding: Crypto.pad.NoPadding
        }).ciphertext;

        // 明文 = 密文 XOR 密钥流
        plainWords.push(cipherWords[i] ^ keystream.words[0]);
        plainWords.push(cipherWords[i + 1] ^ keystream.words[1]);
        plainWords.push(cipherWords[i + 2] ^ keystream.words[2]);
        plainWords.push(cipherWords[i + 3] ^ keystream.words[3]);
    }

    // 6. 明文长度 = 密文长度（GCM 无填充），转 UTF-8
    const plainWordArray = Crypto.lib.WordArray.create(plainWords, cipherBytes);
    return Crypto.enc.Utf8.stringify(plainWordArray);
}

// ============ 生成随机 androidId ============
function generateNonce(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// ============ MD5 哈希 ============
// 优先用猫源原生函数 md5X，不存在则用 Crypto 的 MD5
function md5Hex(str) {
    if (typeof md5X === 'function') {
        return md5X(str);
    }
    return Crypto.MD5(str).toString();
}

// ============ 首页分类 ============
async function home(filter) {
    const classes = [
        { type_id: '剧集', type_name: '剧集' },
        { type_id: '电影', type_name: '电影' },
        { type_id: '综艺', type_name: '综艺' },
        { type_id: '动漫', type_name: '动漫' },
        { type_id: '少儿', type_name: '少儿' },
        { type_id: '纪录片', type_name: '纪录片' }
    ];
    return JSON.stringify({ class: classes, filters: {} });
}

// ============ 首页推荐 ============
async function homeVod() {
    if (!_host) return '{}';
    try {
        const url = _host + '/cache/channel/%E9%A6%96%E9%A1%B5.json';
        const resp = await req(url);
        const data = JSON.parse(resp.content);
        let videos = [];

        data.forEach(it => {
            if (it.showCount === 4) {
                // 轮播/四格推荐
                it.data.forEach(x => {
                    videos.push({
                        vod_id: x.videoId,
                        vod_name: x.videoName,
                        vod_pic: _imgUrl ? (_imgUrl + x.dahengtu) : x.dahengtu,
                        vod_remarks: ''
                    });
                });
            } else if (it.title && it.title !== '轮播图') {
                // 普通频道，取前6条
                it.data.slice(0, 6).forEach(item => {
                    videos.push({
                        vod_id: item.videoId,
                        vod_name: item.videoName,
                        vod_pic: item.fengmiantu,
                        vod_remarks: item.class || ''
                    });
                });
            }
        });

        return JSON.stringify({ list: videos });
    } catch (e) {
        return '{}';
    }
}

// ============ 分类页 ============
async function category(tid, pg, filter, extend) {
    if (!_host) return '{}';
    try {
        let url;
        if (tid === '少儿') {
            url = _host + '/cache/zhaopian/' + tid + '/全部/全部/全部/全部/全部/最新/' + pg + '.json';
        } else {
            url = _host + '/cache/zhaopian/' + tid + '/全部/全部/全部/最新/' + pg + '.json';
        }

        const resp = await req(url);
        const html = JSON.parse(resp.content);
        let videos = [];

        html.forEach(it => {
            videos.push({
                vod_id: it.videoId,
                vod_name: it.videoName,
                vod_pic: it.fengmiantu,
                vod_remarks: it.serialDesc || ''
            });
        });

        return JSON.stringify({ list: videos });
    } catch (e) {
        return '{}';
    }
}

// ============ 详情页 ============
async function detail(ids) {
    if (!_host) return '{}';
    try {
        let id = String(ids);
        // 处理可能带#的id
        if (id.indexOf('#') > -1) {
            id = id.split('#')[0];
        }

        const dir = Math.floor(Number(id) / 1000);
        const url = _host + '/cache/videos/' + dir + '/' + id + '.json?baoming=com.huohuavideo.app&version=' + _version + '&channel=fenxiang';

        const resp = await req(url, {
            headers: { 'User-Agent': 'QingmanLslandApp/1.0' }
        });
        const html = JSON.parse(decrypt(resp.content));

        // 关键：playUrlList 是扁平数组，每集一个对象 { name, ji }
        // 选集url格式: name$videoId$ji$索引（与海阔原版一致）
        const videoId = html.videoId || id;
        const playUrlList = html.playUrlList || [];
        const episodes = playUrlList.map((ep, i) => ep.name + '$' + videoId + '$' + ep.ji + '$' + i);

        return JSON.stringify({
            list: [{
                vod_id: id,
                vod_name: html.videoName || '',
                vod_pic: html.fengmiantu || '',
                vod_remarks: html.serialDesc || '',
                vod_year: html.year || '',
                vod_area: html.region || '',
                vod_director: html.director || '',
                vod_actor: html.actor || '',
                vod_content: html.blurb || html.description || '',
                vod_play_from: '在线播放',
                vod_play_url: episodes.join('#')
            }]
        });
    } catch (e) {
        return '{}';
    }
}

// ============ 搜索 ============
async function search(wd, quick, pg) {
    if (!_host) return '{}';
    try {
        const url = _host + '/vc/api/search/' + encodeURIComponent(wd) + '/' + (pg || '1') + '.json';
        const resp = await req(url);
        const html = JSON.parse(resp.content);
        let videos = [];

        html.forEach(it => {
            videos.push({
                vod_id: it.videoId,
                vod_name: it.videoName,
                vod_pic: it.fengmiantu,
                vod_remarks: it.serialDesc || ''
            });
        });

        return JSON.stringify({ list: videos });
    } catch (e) {
        return '{}';
    }
}

// ============ 播放 ============
async function play(flag, id, flags) {
    if (!_host) return '{}';
    try {
        // id格式: videoId$ji$index（TVBox 自动去掉 name 前缀后传入）
        const parts = String(id).split('$');
        const vid = parts[0];
        const jiid = parts[1];
        const index = parts[2];

        const androidId = generateNonce(16);
        const url = _host + '/vc/api/video/playurl?sid=' + vid + '&ji=' + jiid + '&jiIndex=' + index + '&t=0&y=0&isjiid=1&androidId=' + androidId + '&version=' + _version + '&baoming=com.huohuavideo.app&channel=fenxiang';

        const resp = await req(url, {
            headers: {
                'vuk': md5Hex(vid + _key),
                'User-Agent': 'okhttp/4.12.0'
            }
        });
        const html = JSON.parse(resp.content);

        if (html.data && html.data.url) {
            return JSON.stringify({ parse: 0, url: html.data.url });
        }
        return '{}';
    } catch (e) {
        return '{}';
    }
}

export function __jsEvalReturn() {
    return { init, home, homeVod, category, detail, play, search };
}
