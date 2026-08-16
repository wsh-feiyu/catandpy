# -*- coding: utf-8 -*-
# 火花影视 py 源（TVBox 猫源 Python 版）
# 本资源来源于互联网公开渠道，仅可用于个人学习爬虫技术。

from base.spider import Spider
from Crypto.Cipher import AES
import json, base64, hashlib, secrets, re
import urllib3
from urllib.parse import quote
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import sys
sys.path.append('..')


class Spider(Spider):
    host = ''
    key = 'qvn1u7FCfu981olp980i8uVHVS8Dxih7'
    version = '2.7.0'
    img_url = ''

    # ============ 初始化 ============
    def init(self, extend=''):
        try:
            if isinstance(extend, dict):
                ext = extend
            elif isinstance(extend, str) and extend.strip():
                ext = json.loads(extend.strip())
            else:
                ext = {}
            self.key = ext.get('key', 'qvn1u7FCfu981olp980i8uVHVS8Dxih7')
            self.version = ext.get('version', '2.7.0')
            self.host = ext.get('host', '')
            if not self.host:
                url = 'https://ss.trgfd.cn/cache/index/com.huohuavideo.app.json'
                data = json.loads(self.fetch(url, verify=False).text)
                self.host = data['app']['textURL']
                self.img_url = data['app'].get('resourceURL', '')
        except Exception:
            return

    # ============ 首页分类 ============
    def homeContent(self, filter):
        classes = [
            {'type_id': '剧集', 'type_name': '剧集'},
            {'type_id': '电影', 'type_name': '电影'},
            {'type_id': '综艺', 'type_name': '综艺'},
            {'type_id': '动漫', 'type_name': '动漫'},
            {'type_id': '少儿', 'type_name': '少儿'},
            {'type_id': '纪录片', 'type_name': '纪录片'}
        ]
        return {'class': classes, 'filters': {}}

    # ============ 首页推荐 ============
    def homeVideoContent(self):
        if not self.host:
            return None
        try:
            url = self.host + '/cache/channel/%E9%A6%96%E9%A1%B5.json'
            data = json.loads(self.fetch(url, verify=False).text)
            videos = []
            for it in data:
                if it.get('showCount') == 4:
                    # 轮播/四格推荐
                    for x in it.get('data', []):
                        pic = x.get('dahengtu', '')
                        if self.img_url and pic and not pic.startswith('http'):
                            pic = self.img_url + pic
                        videos.append({
                            'vod_id': x['videoId'],
                            'vod_name': x['videoName'],
                            'vod_pic': pic,
                            'vod_remarks': ''
                        })
                elif it.get('title') and it['title'] != '轮播图':
                    # 普通频道，取前 6 条
                    for item in it.get('data', [])[:6]:
                        videos.append({
                            'vod_id': item['videoId'],
                            'vod_name': item['videoName'],
                            'vod_pic': item.get('fengmiantu', ''),
                            'vod_remarks': item.get('class', '')
                        })
            return {'list': videos}
        except Exception:
            return None

    # ============ 分类页 ============
    def categoryContent(self, tid, pg, filter, ext):
        if not self.host:
            return None
        try:
            if tid == '少儿':
                url = self.host + '/cache/zhaopian/' + tid + '/全部/全部/全部/全部/全部/最新/' + str(pg) + '.json'
            else:
                url = self.host + '/cache/zhaopian/' + tid + '/全部/全部/全部/最新/' + str(pg) + '.json'
            data = json.loads(self.fetch(url, verify=False).text)
            videos = []
            for it in data:
                videos.append({
                    'vod_id': it['videoId'],
                    'vod_name': it['videoName'],
                    'vod_pic': it.get('fengmiantu', ''),
                    'vod_remarks': it.get('serialDesc', '')
                })
            return {'list': videos, 'page': pg}
        except Exception:
            return None

    # ============ 搜索 ============
    def searchContent(self, key, quick, pg='1'):
        if not self.host:
            return None
        try:
            url = self.host + '/vc/api/search/' + quote(key) + '/' + str(pg) + '.json'
            data = json.loads(self.fetch(url, verify=False).text)
            videos = []
            for it in data:
                videos.append({
                    'vod_id': it['videoId'],
                    'vod_name': it['videoName'],
                    'vod_pic': it.get('fengmiantu', ''),
                    'vod_remarks': it.get('serialDesc', '')
                })
            return {'list': videos, 'page': pg}
        except Exception:
            return None

    # ============ 详情页 ============
    def detailContent(self, ids):
        if not self.host:
            return None
        try:
            vid = str(ids[0])
            if '#' in vid:
                vid = vid.split('#')[0]
            dir_id = int(vid) // 1000
            url = self.host + '/cache/videos/' + str(dir_id) + '/' + vid + '.json?baoming=com.huohuavideo.app&version=' + self.version + '&channel=fenxiang'
            resp = self.fetch(url, headers={'User-Agent': 'QingmanLslandApp/1.0'}, verify=False)
            html = json.loads(self.aes_gcm_decrypt(resp.text))

            video_id = html.get('videoId', vid)
            play_url_list = html.get('playUrlList', [])
            episodes = []
            for i, ep in enumerate(play_url_list):
                # 选集 url 格式：name$videoId$ji$索引
                episodes.append(str(ep['name']) + '$' + str(video_id) + '$' + str(ep['ji']) + '$' + str(i))

            video = {
                'vod_id': vid,
                'vod_name': html.get('videoName', ''),
                'vod_pic': html.get('fengmiantu', ''),
                'vod_remarks': html.get('serialDesc', ''),
                'vod_year': html.get('year', ''),
                'vod_area': html.get('region', ''),
                'vod_director': html.get('director', ''),
                'vod_actor': html.get('actor', ''),
                'vod_content': html.get('blurb', '') or html.get('description', ''),
                'vod_play_from': '在线播放',
                'vod_play_url': '#'.join(episodes)
            }
            return {'list': [video]}
        except Exception:
            return None

    # ============ 播放 ============
    def playerContent(self, flag, id, vipflags):
        if not self.host:
            return None
        try:
            parts = str(id).split('$')
            # TVBox 解析 vod_play_url 时按第一个 $ 分割，去掉 name 前缀后传入
            # 实际 id 格式：videoId$ji$index
            vid = parts[0]
            jiid = parts[1]
            index = parts[2]
            android_id = self.generate_nonce(16)
            url = self.host + '/vc/api/video/playurl?sid=' + vid + '&ji=' + jiid + '&jiIndex=' + index + '&t=0&y=0&isjiid=1&androidId=' + android_id + '&version=' + self.version + '&baoming=com.huohuavideo.app&channel=fenxiang'
            headers = {
                'vuk': self.md5(vid + self.key),
                'User-Agent': 'okhttp/4.12.0'
            }
            html = json.loads(self.fetch(url, headers=headers, verify=False).text)
            if html.get('data') and html['data'].get('url'):
                return {'jx': '0', 'parse': '0', 'url': html['data']['url']}
            return None
        except Exception:
            return None

    # ============ 辅助方法 ============
    # AES-GCM 解密：密文格式 Base64( IV(12) + 密文 + tag(16) )
    def aes_gcm_decrypt(self, data):
        raw = base64.b64decode(data)
        iv = raw[:12]
        tag = raw[-16:]
        ciphertext = raw[12:-16]
        cipher = AES.new(self.key.encode('utf-8'), AES.MODE_GCM, nonce=iv)
        plaintext = cipher.decrypt_and_verify(ciphertext, tag)
        return plaintext.decode('utf-8')

    def md5(self, text):
        return hashlib.md5(text.encode('utf-8')).hexdigest()

    def generate_nonce(self, length=16):
        chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        return ''.join(secrets.choice(chars) for _ in range(length))

    def getName(self):
        pass

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass
