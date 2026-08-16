# -*- coding: utf-8 -*-
"""
TVBox Python 源本地调试用的 urllib3 stub 子模块：exceptions。

提供源码常用的 InsecureRequestWarning 等异常类型。
"""
import sys

try:
    # 真实 urllib3 已加载时，直接复用其 exceptions
    import urllib3 as _real
    if hasattr(_real, 'exceptions'):
        sys.modules[__name__] = _real.exceptions
except ImportError:
    pass


class HTTPWarning(Warning):
    pass


class HTTPError(Exception):
    pass


class InsecureRequestWarning(HTTPWarning):
    pass


class InsecurePlatformWarning(HTTPWarning):
    pass


class MaxRetryError(Exception):
    pass
