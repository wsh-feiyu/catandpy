# TVBox Spider Studio

TVBox 的 JS / Python 源编写与调试框架，参考 [FongMi/TV](https://github.com/FongMi/TV) 的 SPIDER 规范实现。
内置 Web 版调试台与 TVBox 模拟器，可直接在浏览器里调试 `.js` 猫源和 `.py` 源，无需真机。

## 功能特性

- **Monaco 代码编辑器**：语法高亮、函数自动补全（`req` / `http` / `aesX` / `md5X` / `desX` / `pd` / `pdfh` / `pdfa` / `cheerio` 等 TVBox 全局 API）。
- **JS 源运行时**：在 Node.js 的 `vm` 中模拟 FongMi 猫源 QuickJS 环境，直接复用从 TV apk 提取的真实运行时文件（`cat.js` / `cheerio.min.js` / `gbk.js` / `similarity.js` / `http.js`），行为与真机一致。
- **PY 源运行时**：通过本机 Python 解释器 + mock `base.spider` 执行 `.py` 源。
- **调试台**：选择方法（`home` / `category` / `detail` / `play` / `search`…）、填写参数与 ext，一键运行并查看返回结果、日志、HTTP 请求记录。
- **ext 参数管理**：每个源可单独配置 ext 键值对，自动生成 JSON 并持久化保存。
- **TVBox 模拟器**：模拟 TVBox 首页/分类/详情/播放/搜索流程，可直观看到源在各接口下的表现。
- **向导生成**：通过表单快速生成标准 `.js` / `.py` 源骨架。

## 目录结构

```
catandpy/
├── sources/                  # 源文件工作区（存放你的 .js / .py 源）
│   ├── Hmys.js
│   ├── 火花影视.js
│   └── 火花影视.py
├── fongmi-tv-js/             # 从 TV apk 提取的真实运行时文件（勿删）
│   └── lib/
├── spider-studio/            # 框架本体
│   ├── public/               # 前端（编辑器 / 调试台 / 模拟器）
│   ├── server/               # 后端服务与运行时
│   │   ├── index.js          # Express 主服务
│   │   ├── js-runtime.js     # JS 源 mock 运行时
│   │   ├── py-runner.js      # PY 源运行器
│   │   └── ext-config.json   # 各源 ext 参数持久化存储
│   └── package.json
└── README.md
```

## 环境要求

- [Node.js](https://nodejs.org/) ≥ 16（调试 JS 源必需）
- [Python](https://www.python.org/) ≥ 3.8（调试 PY 源必需；不用 PY 源可跳过）
- 浏览器推荐使用最新版 Chrome / Edge

## 快速开始

### 1. 克隆项目

```bash
git clone <本项目地址> catandpy
cd catandpy
```

### 2. 安装依赖

```bash
cd spider-studio
npm install
```

### 3. 启动服务

```bash
npm start
```

看到以下输出即启动成功：

```
==============================================
  TVBox Spider Studio 已启动
  前端: http://localhost:8737
  源目录: D:\...\catandpy\sources
==============================================
```

### 4. 打开页面

浏览器访问 [http://localhost:8737](http://localhost:8737) 即可开始使用。

首次运行时 `sources/` 目录会自动创建，把要调试的 `.js` / `.py` 源放进去，点击「刷新列表」即可看到。

## 使用说明

### 新建 / 编辑源

- 点顶栏「新建源」或左侧「+ 新建」，通过向导填写站点信息生成源骨架。
- 在左侧列表点击源文件打开编辑，`Ctrl+S` 保存。
- 右键源文件可删除 / 重命名。

### 调试 JS 源

1. 打开一个 `.js` 源。
2. 右侧调试台选择「调用方法」（如 `home`、`detail`、`play`）。
3. 按需填写方法参数与 ext 键值对。
4. 点「运行」，在下方标签页查看：**结果**、**日志**、**请求**、**错误**。

### 调试 PY 源

步骤同上，方法名对应 `homeContent` / `categoryContent` / `detailContent` / `searchContent` / `playerContent`。

### TVBox 模拟器

右侧面板顶部切换到「模拟器」标签，即可像 TVBox 一样浏览：首页 → 分类 → 详情 → 播放，并可搜索。切换源文件后模拟器会自动重置。

### ext 参数

- 部分动态源（如 `Hmys.js`）需要 ext 参数（`host` / `appid` / `versionCode` 等）才能正常工作。
- 在调试台「ext / extend 参数」区域点击「+ 添加键值」逐条填写，系统自动生成 JSON 并持久化保存。
- 重新打开该源时参数会自动加载。

## 环境变量配置（可选）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 服务端口 | `8737` |
| `TVBOX_SOURCE_DIR` | 源文件目录（可指向其它盘符） | `<项目>/sources` |
| `TVBOX_PYTHON` | 指定 Python 解释器命令 | 自动探测 `python` / `python3` |

## 常见问题

- **PY 源提示未找到 Python**：请安装 Python 并加入 PATH，或用 `TVBOX_PYTHON` 指定解释器路径。
- **页面无数据 / 表现异常**：框架静态资源已禁用缓存，如仍异常请强制刷新（`Ctrl+F5`）。
- **依赖版本冲突**：删除 `spider-studio/node_modules` 后重新执行 `npm install`。

## 参考规范

- [FongMi/TV SPIDER.md](https://github.com/FongMi/TV/blob/main/spider/README.md)
