# Gemini to Markdown

**将 Gemini Canvas / Deep Research 页面内容一键导出为 Markdown 格式。**

这是一个 JavaScript 工具，旨在帮助用户将 Google Gemini 的 Canvas 界面、Deep Research 深度搜索结果以及对话内容高质量地转换为 Markdown 文档。支持数学公式、代码块、表格等复杂格式的完美还原。

## ✨ 功能特性

- **一键导出**：自动在页面内容区域（如 Canvas、对话框）添加悬浮按钮，支持「复制」和「导出文件」。
- **完美兼容**：
  - 自动识别 `.markdown`, `.ProseMirror`, `.model-response-text` 等常见容器。
  - 动态扫描：自动检测新加载的内容（如流式输出或新对话）。
- **格式还原**：
  - **数学公式**：完美支持 LaTeX 公式（行内 `$latex$` 与 块级 `$$latex$$`）。
  - **代码块**：保留语言标记，还原 ` ```language ` 格式。
  - **表格**：自动转换为 Markdown 表格，支持对齐方式。
  - **列表**：支持有序列表、无序列表及任务列表（`[ ]` / `[x]`）。
  - **其他**：支持引用块、折叠详情 (`<details>`)、图片、角标引用等。

## 🚀 如何使用

### 方法一：控制台直接运行 (临时使用)

1. 打开 [Google Gemini](https://gemini.google.com/) 页面。
2. 按 `F12` 或右键点击页面选择「检查」打开开发者工具。
3. 切换到 **Console (控制台)** 标签页。
4. 将 `main.js` 中的代码完整复制并粘贴到控制台，按回车执行。
5. 页面右上角会出现 **Copy** 和 **Export** 的悬浮按钮。

### 方法二：保存为书签 (Bookmarklet)

1. 创建一个新的浏览器书签。
2. 在「网址」栏填入以下代码（需将 `main.js` 内容压缩为一行）：
   ```javascript
   javascript:(function(){/* 这里粘贴 main.js 的全部代码 */})();
   ```
3. 需要导出时，点击一下该书签即可。

### 方法三：油猴脚本 (推荐)

如果你安装了 Tampermonkey 或 Violentmonkey 扩展：
1. 创建新脚本。
2. 将 `main.js` 的内容粘贴进去。
3. 设置匹配规则为 `https://gemini.google.com/*`。
4. 保存后，每次打开 Gemini 页面都会自动加载导出按钮。

## 🛠️ 支持的格式转换

| HTML 元素 | Markdown 转换示例 |
| :--- | :--- |
| `<h1>` - `<h6>` | `# 标题` |
| `<b>`, `<strong>` | `**加粗**` |
| `<i>`, `<em>` | `*斜体*` |
| `<s>`, `<del>` | `~~删除线~~` |
| Code Block | \`\`\`language ... \`\`\` |
| Math (LaTeX) | `$$ ... $$` 或 `$ ... $` |
| Table | `| Header | ... |` |
| List (`<ul>`, `<ol>`) | `- 项目` 或 `1. 项目` |
| Task List | `[ ] 待办` / `[x] 完成` |
| Blockquote | `> 引用内容` |
| Link, Image | `[文本](链接)`, `![Alt](图片URL)` |

## 📄 License

MIT License
