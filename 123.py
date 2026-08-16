# -*- coding: utf-8 -*-
# 123 - TVBox 猫源 PY 爬虫（由 Spider Studio 生成）
# 参考规范: FongMi/TV SPIDER.md
# 基类 base.spider.Spider 在本地调试时已 mock（fetch/json/html/pdfh 等）

from base.spider import Spider
import json

class Spider(Spider):
    host = 'http://123.com'

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
        classes = [
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
]
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
