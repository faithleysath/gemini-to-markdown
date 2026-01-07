# Gemini to Markdown Exporter

![License](https://img.shields.io/github/license/faithleysath/gemini-to-markdown)
![Version](https://img.shields.io/badge/version-1.1-blue)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-green)

**将 Gemini Canvas / Deep Research 页面内容一键导出为 Markdown 格式。**

这是一个 JavaScript 工具，旨在帮助用户将 [Google Gemini](https://gemini.google.com/) 的 Canvas 界面、Deep Research 深度搜索结果以及普通对话内容高质量地转换为 Markdown 文档。


## ✨ 功能特性

- **🖱️ 一键导出**：自动在页面内容区域（如 Canvas、对话框）添加悬浮按钮，支持「复制到剪贴板」和「导出 .md 文件」。
- **🔄 智能同步**：
  - 自动识别 Deep Research、Canvas 及普通聊天界面。
  - **动态监听**：自动检测流式输出或新加载的对话，无需手动刷新。
- **📝 完美格式还原**：
  - **数学公式**：支持 LaTeX 格式（行内 `$latex$` 与 块级 `$$latex$$`）。
  - **代码块**：保留语言标记，还原 ` ```language ` 格式。
  - **表格**：自动转换为 Markdown 表格，支持对齐方式。
  - **引用与列表**：支持多级列表、任务列表（`[ ]`/`[x]`）及引用块。
  - **其他**：保留图片链接、角标引用及折叠详情 (`<details>`)。

## 🚀 如何使用

### 方式一：油猴脚本 (推荐 ⭐)

最稳定的使用方式，支持自动更新。

1. 确保浏览器已安装 [Tampermonkey](https://www.tampermonkey.net/) 或 Violentmonkey 扩展。
2. **[👉 点击此处直接安装](https://github.com/faithleysath/gemini-to-markdown/raw/main/gemini-to-markdown.user.js)**
3. 在弹出的窗口中点击「安装」。
4. 刷新 Gemini 页面即可看到悬浮按钮。

### 方式二：控制台运行 (临时使用)

1. 按 `F12` 打开开发者工具，切换到 **Console**。
2. 粘贴 `gemini-to-markdown.user.js` 的全部代码并回车。

## 🛠️ 格式转换对照表

| HTML 元素 | Markdown 转换示例 |
| --- | --- |
| `<h1>` - `<h6>` | `# 标题` |
| `<b>`, `<strong>` | `**加粗**` |
| Code Block | ```language ... ``` |
| Math (LaTeX) | `$$...$$` 或 `$ ... $` |
| Table | ` |
| Task List | `[ ] 待办` / `[x] 完成` |
| Image | `![Alt](图片URL)` |
| Clean UI | 自动移除底部的 Sources Carousel、无关按钮 |

## ⚠️ 注意事项

* 本脚本依赖 Google Gemini 的网页结构 (DOM)。如果 Google 更新了界面代码，脚本可能会暂时失效。
* 欢迎提交 [Issue](https://www.google.com/search?q=https://github.com/faithleysath/gemini-to-markdown/issues) 反馈 Bug 或建议。

## 📄 License

MIT License
