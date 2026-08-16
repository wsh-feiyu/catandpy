/**
 * PY 源运行器：调用本机 Python 解释器 + mock base.spider 执行 .py 源
 */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MOCK_DIR = path.join(__dirname, 'py-mock');
const RUNNER = path.join(MOCK_DIR, 'runner.py');

// 常见方法名 -> 默认关键字参数
const DEFAULT_KWARGS = {
  homeContent: { filter: {} },
  homeVideoContent: {},
  categoryContent: { tid: '电影', pg: '1', filter: true, ext: {} },
  detailContent: { ids: ['1'] },
  searchContent: { key: '猫', quick: false, pg: '1' },
  playerContent: { flag: '', id: '', vipflags: [] },
};

function detectPython() {
  const candidates = process.env.TVBOX_PYTHON
    ? [process.env.TVBOX_PYTHON]
    : ['python', 'python3'];
  for (const cmd of candidates) {
    try {
      const r = spawnSync(cmd, ['--version'], { timeout: 10000, encoding: 'utf-8' });
      if (r.status === 0) return cmd;
    } catch (e) {
      /* 继续尝试下一个 */
    }
  }
  return null;
}

function runPySource({ path: sourcePath, method, kwargs, ext }) {
  const outFile = path.join(os.tmpdir(), `tvbox-debug-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const py = detectPython();
  if (!py) {
    return {
      ok: false,
      error: '未找到 Python 解释器（尝试 python / python3），请安装 Python 或设置环境变量 TVBOX_PYTHON',
      logs: [],
      pyOut: '',
    };
  }

  const params = kwargs && typeof kwargs === 'object' && Object.keys(kwargs).length
    ? kwargs
    : DEFAULT_KWARGS[method] || {};

  const r = spawnSync(
    py,
    [RUNNER, sourcePath, method, JSON.stringify(params), JSON.stringify(ext || '{}'), outFile],
    {
      timeout: 60000,
      encoding: 'utf-8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    }
  );

  let result = null;
  let logs = [];
  let error = null;
  let pyOut = '';

  if (r.error) {
    error = 'Python 执行失败: ' + r.error.message;
  } else {
    pyOut = (r.stdout || '') + (r.stderr ? '\n[stderr]\n' + r.stderr : '');
    try {
      if (fs.existsSync(outFile)) {
        const data = JSON.parse(fs.readFileSync(outFile, 'utf-8'));
        result = data.result;
        logs = data.logs || [];
        error = data.error || null;
        fs.unlinkSync(outFile);
      }
    } catch (e) {
      error = '解析执行结果失败: ' + e.message + '\n' + pyOut;
    }
  }

  return { ok: !error, method, result, logs, error, pyOut };
}

module.exports = { runPySource, detectPython };
