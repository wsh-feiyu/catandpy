# -*- coding: utf-8 -*-
"""
TVBox Python 源本地调试用的 urllib3 stub。

真实 TVBox(Chaquopy) 环境自带 urllib3，而本机可能未安装。
源码通常只用到 urllib3.disable_warnings(...) 与 urllib3.exceptions.InsecureRequestWarning，
这里提供最小兼容实现。若本机已安装真 urllib3，则直接复用真实实现。
"""
from . import exceptions  # noqa: E402,F401


def disable_warnings(*args, **kwargs):
    pass


def request(method, url, *args, **kwargs):
    raise NotImplementedError('urllib3 stub 不支持 request()。请使用 Spider.fetch() 发起请求。')


def PoolManager(*args, **kwargs):
    raise NotImplementedError('urllib3 stub 不支持 PoolManager()。请使用 Spider.fetch() 发起请求。')
