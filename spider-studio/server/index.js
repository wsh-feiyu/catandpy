/**
 * TVBox Spider Studio 主服务
 *  - 静态托管前端 (public/)
 *  - 源文件管理 API
 *  - JS/PY 源调试 API
 *  - 模板/向导 API
 */
'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const { runJsSource } = require('./js-runtime');
const { runPySource, detectPython } = require('./py-runner');
const { getTemplates, generateWizardSource } = require('./templates');

// 源文件根目录：框架目录（spider-studio）的上一级，即用户存放 .js/.py 源的目录
const ROOT = path.resolve(__dirname, '..', '..');
const PUB = path.join(__dirname, '..', 'public');
const PORT = process.env.PORT || 8737;

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUB));

// 路径安全校验：只能访问 ROOT 内的文件
function resolveSafe(p) {
  if (!p || typeof p !== 'string') return null;
  const abs = path.resolve(ROOT, p);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null;
  return abs;
}

// ============ 文件管理 ============
app.get('/api/files', (req, res) => {
  try {
    const entries = fs.readdirSync(ROOT, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => {
        const name = e.name;
        const ext = path.extname(name).toLowerCase();
        const st = fs.statSync(path.join(ROOT, name));
        return {
          name,
          ext,
          type: ext === '.js' ? 'js' : ext === '.py' ? 'py' : 'other',
          size: st.size,
          mtime: st.mtimeMs,
        };
      })
      .filter((f) => f.type === 'js' || f.type === 'py')
      .sort((a, b) => (a.type === b.type ? b.mtime - a.mtime : a.type === 'js' ? -1 : 1));
    res.json({ ok: true, root: ROOT, files });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/file', (req, res) => {
  const abs = resolveSafe(req.query.path);
  if (!abs) return res.status(400).json({ ok: false, error: '非法路径' });
  try {
    const content = fs.readFileSync(abs, 'utf-8');
    res.json({ ok: true, content, path: req.query.path });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/file', (req, res) => {
  const abs = resolveSafe(req.body.path);
  if (!abs) return res.status(400).json({ ok: false, error: '非法路径' });
  try {
    fs.writeFileSync(abs, req.body.content, 'utf-8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 新建源：body = { filename, lang, content? }  或向导参数
app.post('/api/file/new', (req, res) => {
  try {
    let content = req.body.content;
    if (content == null) {
      const t = getTemplates();
      content = req.body.lang === 'py' ? t.py : t.js;
    }
    const abs = resolveSafe(req.body.filename);
    if (!abs) return res.status(400).json({ ok: false, error: '非法文件名' });
    if (fs.existsSync(abs)) {
      return res.status(400).json({ ok: false, error: '文件已存在' });
    }
    fs.writeFileSync(abs, content, 'utf-8');
    res.json({ ok: true, path: req.body.filename });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/file/delete', (req, res) => {
  const abs = resolveSafe(req.body.path);
  if (!abs) return res.status(400).json({ ok: false, error: '非法路径' });
  try {
    fs.unlinkSync(abs);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/file/rename', (req, res) => {
  const oldAbs = resolveSafe(req.body.path);
  const newAbs = resolveSafe(req.body.newName);
  if (!oldAbs || !newAbs) return res.status(400).json({ ok: false, error: '非法路径' });
  try {
    if (fs.existsSync(newAbs)) return res.status(400).json({ ok: false, error: '目标文件已存在' });
    fs.renameSync(oldAbs, newAbs);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============ 模板 / 向导 ============
app.get('/api/templates', (req, res) => {
  res.json({ ok: true, templates: getTemplates() });
});

app.post('/api/wizard', (req, res) => {
  try {
    const out = generateWizardSource(req.body);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ============ 调试 ============
app.post('/api/debug/js', async (req, res) => {
  const abs = resolveSafe(req.body.path);
  if (!abs) return res.status(400).json({ ok: false, error: '非法路径' });
  const r = await runJsSource({
    path: abs,
    method: req.body.method || 'home',
    args: req.body.args,
    ext: req.body.ext,
    config: req.body.config,
  });
  res.json({ ok: true, ...r });
});

app.post('/api/debug/py', (req, res) => {
  const abs = resolveSafe(req.body.path);
  if (!abs) return res.status(400).json({ ok: false, error: '非法路径' });
  const r = runPySource({
    path: abs,
    method: req.body.method || 'homeContent',
    kwargs: req.body.kwargs,
    ext: req.body.ext,
  });
  res.json({ ok: true, ...r });
});

app.get('/api/env', (req, res) => {
  const py = detectPython();
  let pyVersion = null;
  if (py) {
    const { spawnSync } = require('child_process');
    const r = spawnSync(py, ['--version'], { encoding: 'utf-8' });
    pyVersion = r.stdout || r.stderr;
  }
  res.json({
    ok: true,
    node: process.version,
    root: ROOT,
    python: py ? { cmd: py, version: (pyVersion || '').trim() } : null,
  });
});

app.listen(PORT, () => {
  console.log('==============================================');
  console.log('  TVBox Spider Studio 已启动');
  console.log('  前端: http://localhost:' + PORT);
  console.log('  源目录: ' + ROOT);
  console.log('==============================================');
});
