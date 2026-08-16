# -*- coding: utf-8 -*-
"""
TVBox Python 源本地调试执行器。

用法（由 Node 端调用）：
    python runner.py <源文件路径> <方法名> <参数JSON> <extJSON> <输出文件>

- 方法名：homeContent / homeVideoContent / categoryContent /
         detailContent / searchContent / playerContent / init
- 参数 JSON 以关键字参数形式传给方法（key 为参数名）
- 执行结果写入输出文件（JSON），源内部 print 的内容走标准输出返回给 Node 展示
"""
import os
import sys
import json
import traceback
import importlib.util

# 让 mock 的 base 包可被导入
_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)


def load_source(source_path):
    """按文件路径加载源模块（文件名可能含中文，用 importlib 最稳）"""
    spec = importlib.util.spec_from_file_location('tvbox_source', source_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    source_path = sys.argv[1]
    method = sys.argv[2]
    params_json = sys.argv[3] if len(sys.argv) > 3 else '{}'
    ext_json = sys.argv[4] if len(sys.argv) > 4 else '{}'
    out_file = sys.argv[5] if len(sys.argv) > 5 else ''

    logs = []
    result = None
    error = None

    try:
        params = json.loads(params_json)
        ext = json.loads(ext_json)

        mod = load_source(source_path)
        spider = mod.Spider()

        # 接管调试日志
        spider.log = lambda *a: logs.append(' '.join(str(x) for x in a))

        # 初始化：兼容 init(extend) / init() 两种签名
        try:
            spider.init(ext)
        except TypeError:
            spider.init()
        except Exception as e:
            logs.append('init error: %s' % e)

        if method == 'init':
            result = None
        else:
            fn = getattr(spider, method, None)
            if fn is None:
                error = '方法 %s 不存在，可用方法: %s' % (method, ', '.join(
                    m for m in ['homeContent', 'homeVideoContent', 'categoryContent',
                                'detailContent', 'searchContent', 'playerContent', 'init']
                    if hasattr(spider, m)))
            else:
                result = fn(**params)
    except Exception as e:
        error = traceback.format_exc()

    out = {'result': result, 'logs': logs, 'error': error}
    if out_file:
        with open(out_file, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, default=str)
    else:
        print(json.dumps(out, ensure_ascii=False, default=str))


if __name__ == '__main__':
    main()
