# -*- coding: utf-8 -*-
"""
TVBox Python 源本地调试用的 mock base.spider 模块。

在真实 TVBox(Chaquopy) 环境中，Spider 基类由应用提供 fetch/json/html 等能力。
这里用纯标准库实现等价功能，使 .py 源可以脱离 TVBox 在本地直接运行调试。

返回的 Response 对象尽量兼容 requests.Response 的常用属性：
  .text / .content / .status_code / .headers / .url / .json()
"""
import json
import re
import ssl
import zlib
import gzip
import urllib.request
import urllib.error
import urllib.parse


class Response(object):
    """兼容 requests.Response 的最小实现"""

    def __init__(self, resp):
        raw = resp.read()
        encoding = (resp.headers.get('Content-Encoding') or '').lower()
        if encoding == 'gzip':
            raw = gzip.decompress(raw)
        elif encoding == 'deflate':
            try:
                raw = zlib.decompress(raw)
            except Exception:
                pass
        self._raw = raw
        self.url = resp.geturl()
        self.status_code = resp.status
        self.headers = {k.lower(): v for k, v in resp.headers.items()}
        # 智能解码：优先 utf-8，失败回退 gbk（很多中文站）
        try:
            self.text = raw.decode('utf-8')
        except UnicodeDecodeError:
            self.text = raw.decode('gbk', errors='replace')

    @property
    def content(self):
        return self._raw

    def json(self):
        return json.loads(self.text)


class Spider(object):
    """
    调试用基类。真实环境（com.github.catvod.spider.Spider）的方法签名：
      init(extend) / homeContent(filter) / homeVideoContent()
      categoryContent(tid, pg, filter, extend) / detailContent(ids)
      searchContent(key, quick, pg) / playerContent(flag, id, vipflags)
    """

    def __init__(self):
        self.host = ''
        self.headers = {'User-Agent': 'Mozilla/5.0 (TVBox Spider Studio)'}
        self.logs = []

    # ---------- 调试日志（不会影响真实 TVBox） ----------
    def log(self, *args):
        text = ' '.join(str(a) for a in args)
        self.logs.append(text)

    # ---------- 网络请求 ----------
    def fetch(self, url, headers=None, timeout=10, verify=False, **kwargs):
        self.log('fetch: ' + str(url))
        hdrs = dict(self.headers)
        if headers:
            hdrs.update(headers)
        # 对 URL 中的非 ASCII 字符做 percent 编码（兼容中文路径/参数）
        url = urllib.parse.quote(str(url), safe=":/?&=#%+~!$'()*,-._")
        ctx = None
        if not verify:
            ctx = ssl._create_unverified_context()
        req = urllib.request.Request(url, headers=hdrs)
        try:
            resp = urllib.request.urlopen(req, timeout=timeout, context=ctx)
            return Response(resp)
        except urllib.error.HTTPError as e:
            self.log('fetch http-error: %s %s' % (e.code, url))
            raise e
        except Exception as e:
            self.log('fetch error: %s' % e)
            raise e

    # ---------- 解析辅助 ----------
    def json(self, content):
        return json.loads(content)

    def html(self, content):
        return content

    def _format_url(self, url, base=''):
        if not url:
            return ''
        if url.startswith('http'):
            return url
        if base and url.startswith('/'):
            return base + url
        if base:
            return base + '/' + url.lstrip('/')
        return url

    def pd(self, content, rule, add_url=True):
        """正则取第一个匹配（简化实现，支持 &&前缀）"""
        base = ''
        re_str = rule
        if '&&' in rule:
            segs = rule.split('&&')
            re_str = segs[0]
            m = re.match(r'https?://[^/]+', segs[1] or '')
            if m:
                base = m.group(0)
        m = re.search(re_str, content)
        if m:
            val = m.group(1) if m.groups() else m.group(0)
            return self._format_url(val or '', base)
        return ''

    def pdfh(self, content, rule, add_url=True):
        return self.pd(content, rule, add_url)

    def pdyh(self, content, rule, add_url=True):
        return self.pd(content, rule, add_url)

    def pdfa(self, content, rule, add_url=True):
        base = ''
        re_str = rule
        if '&&' in rule:
            segs = rule.split('&&')
            re_str = segs[0]
            m = re.match(r'https?://[^/]+', segs[1] or '')
            if m:
                base = m.group(0)
        return [self._format_url(x if isinstance(x, str) else x, base) for x in re.findall(re_str, content)]

    def pdfl(self, *args, **kwargs):
        return self.pdfa(*args, **kwargs)

    # ---------- 占位（子类可选覆写） ----------
    def getName(self):
        pass

    def isVideoFormat(self, url):
        return True

    def manualVideoCheck(self):
        return False

    def destroy(self):
        pass
