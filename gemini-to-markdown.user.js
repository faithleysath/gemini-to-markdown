// ==UserScript==
// @name         Gemini to Markdown Exporter
// @namespace    https://github.com/faithleysath/gemini-to-markdown
// @version      1.1
// @description  Export Gemini chat and Deep Research canvas to Markdown with one click. 包含 HTML 转 Markdown 核心逻辑，支持 Deep Research、Canvas 和普通聊天。
// @author       faithleysath
// @match        https://gemini.google.com/*
// @icon         https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
(function () {
  if (window.__GEMINI_EXPORT_TIMER__) {
    clearInterval(window.__GEMINI_EXPORT_TIMER__);
  }
  // === 终极通用版：HTML 转 Markdown ===
  // 兼容：ProseMirror 编辑器、Angular 前端、常见 AI 对话界面
  function htmlToMarkdown(rootElement) {
    if (!rootElement) return "";

    // 定义需要忽略的 UI 噪音标签 (Type 2 特有)
    const IGNORE_TAGS = [
      "SOURCES-CAROUSEL-INLINE",
      "SOURCES-CAROUSEL",
      "BUTTON",
      "MAT-ICON",
      "STYLE",
      "SCRIPT",
      "svg", // 通常图标 SVG 不需要转换
    ];

    function traverse(node, context = {}) {
      // 1. 文本节点处理
      if (node.nodeType === Node.TEXT_NODE) {
        if (context.inPre) return node.textContent; // 代码块内保留所有格式
        // 压缩多余空格，但保留单词间的空格
        return node.textContent.replace(/\n/g, " ").replace(/\s+/g, " ");
      }

      // 2. 元素节点处理
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName.toUpperCase();

      // 遇到噪音标签直接忽略
      if (IGNORE_TAGS.includes(tag)) return "";

      // 忽略 ProseMirror 的末尾占位符 (Type 1 特有)
      if (node.classList.contains("ProseMirror-trailingBreak")) return "";

      // 穿透容器标签 (如 response-element)
      if (tag === "RESPONSE-ELEMENT") {
        let inner = "";
        node.childNodes.forEach((child) => (inner += traverse(child, context)));
        return inner;
      }

      // === 核心逻辑：数学公式 (兼容 Type 1 & Type 2) ===
      // 只要有 data-math 属性，优先提取 LaTeX，跳过内部复杂的渲染 DOM
      if (node.hasAttribute("data-math")) {
        const latex = node.getAttribute("data-math");
        // 判断是否为块级公式：
        // 1. tag 是 MATH-BLOCK (Type 1)
        // 2. class 包含 math-block (Type 1 & 2)
        // 3. display 样式为 block
        const isBlock =
          tag === "MATH-BLOCK" ||
          node.classList.contains("math-block") ||
          node.style.display === "block";

        if (isBlock) {
          return `\n\n$$\n${latex}\n$$\n\n`;
        } else {
          return `$${latex}$`;
        }
      }

      // === 特殊元素映射 ===

      // 任务列表复选框 (Type 1 特有)
      if (tag === "INPUT" && node.type === "checkbox") {
        return node.checked ? "[x] " : "[ ] ";
      }

      // 引用角标 (Type 2 特有)
      if (tag === "SUP" && node.hasAttribute("data-turn-source-index")) {
        const index = node.getAttribute("data-turn-source-index");
        return `[^${index}]`;
      }

      // 图片
      if (tag === "IMG") {
        const alt = node.getAttribute("alt") || "";
        const src = node.getAttribute("src") || "";
        return `![${alt}](${src})`;
      }

      // 换行与分割线
      if (tag === "BR") return "  \n";
      if (tag === "HR") return "\n\n---\n\n";

      // 代码块 (兼容 Type 1 PRE & Type 2 CODE-BLOCK)
      if (tag === "CODE-BLOCK" || tag === "PRE") {
        const codeEl = node.querySelector("code") || node; // 优先找内部 code，找不到用自身
        let lang = "";
        // 尝试从 class="language-xyz" 获取语言
        const langMatch = (codeEl.className || "").match(
          /language-([a-z0-9]+)/i,
        );
        lang = langMatch ? langMatch[1] : "";

        // 获取内容 (innerText 在某些浏览器处理换行更好)
        const content = codeEl.innerText || codeEl.textContent;
        return `\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n`;
      }

      // 表格 (通用)
      if (tag === "TABLE") {
        const rows = Array.from(node.querySelectorAll("tr"));
        let mdTable = "\n";
        rows.forEach((row, i) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          const rowText =
            "| " +
            cells.map((c) => traverse(c, context).trim()).join(" | ") +
            " |";
          mdTable += rowText + "\n";
          // 表头分隔线
          if (i === 0) {
            mdTable +=
              "| " +
              cells
                .map((cell) => {
                  const style = cell.getAttribute("style") || "";
                  if (style.includes("center")) return ":---:";
                  if (style.includes("right")) return "---:";
                  return "---";
                })
                .join(" | ") +
              " |\n";
          }
        });
        return mdTable + "\n";
      }

      // === 递归遍历子元素 ===
      let childrenContent = "";
      // 标记是否在 PRE/CODE 内部，避免二次处理
      const newContext = {
        ...context,
        inPre: context.inPre || tag === "PRE" || tag === "CODE-BLOCK",
        inList: context.inList || tag === "LI",
      };

      node.childNodes.forEach((child) => {
        childrenContent += traverse(child, newContext);
      });

      // === 包装容器格式化 ===
      switch (tag) {
        case "H1":
          return `\n# ${childrenContent}\n`;
        case "H2":
          return `\n## ${childrenContent}\n`;
        case "H3":
          return `\n### ${childrenContent}\n`;
        case "H4":
          return `\n#### ${childrenContent}\n`;
        case "H5":
          return `\n##### ${childrenContent}\n`;

        case "P":
          // 列表内的 P 标签不强制双换行，普通 P 需要
          if (context.inList) return childrenContent;
          return `\n${childrenContent}\n`;

        case "STRONG":
        case "B":
          return `**${childrenContent}**`;

        case "EM":
        case "I":
          return `*${childrenContent}*`;

        case "DEL":
        case "S":
          return `~~${childrenContent}~~`;

        case "CODE":
          if (context.inPre) return childrenContent;
          return `\`${childrenContent}\``;

        case "BLOCKQUOTE":
          // 处理多行引用的每一行
          return `\n> ${childrenContent.trim().split("\n").join("\n> ")}\n`;

        case "UL":
        case "OL":
          return `\n${childrenContent}\n`;

        case "LI":
          const parent = node.parentElement;
          let prefix = "- ";
          if (parent && parent.tagName === "OL") {
            // 尝试计算有序列表索引
            const start = parseInt(parent.getAttribute("start")) || 1;
            const index = Array.from(parent.children)
              .filter((el) => el.tagName === "LI")
              .indexOf(node);
            prefix = `${start + index}. `;
          }
          return `${prefix}${childrenContent.trim()}\n`; // trim() 很重要，移除li内部可能存在的首尾换行

        case "A":
          const href = node.getAttribute("href");
          if (!href) return childrenContent;
          // 如果是锚点链接且没有内容，可能需要特殊处理，这里默认标准处理
          return `[${childrenContent}](${href})`;

        case "DETAILS":
          return `\n<details>\n${childrenContent}\n</details>\n`;

        case "SUMMARY":
          return `<summary>${childrenContent}</summary>\n`;

        default:
          return childrenContent;
      }
    }

    let result = traverse(rootElement);
    // 清理多余空行 (超过2个换行变成2个)
    return result.replace(/\n{3,}/g, "\n\n").trim();
  }

  // === 主程序执行 ===
  
  // 1. 定义选择器
  const selectors = [
    ".markdown",
    ".ProseMirror",
    ".model-response-text",
    "markdown-viewer"
  ];

  // 2. 定义扫描函数 (核心逻辑移到这里统一处理)
  let processedContainers = new WeakSet(); // 用于追踪已处理过的容器

  function scanAndAddButtons() {
    // 扫描所有目标选择器
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach((container, index) => {
        // 如果该容器未处理过，则添加按钮
        if (!processedContainers.has(container)) {
          // 二次检查：DOM中是否真的已有按钮（防止WeakSet在某些极端情况下失效）
          if (!container.querySelector('.gemini-export-float-btn')) {
            createFloatingButton(container, processedContainers.size);
            processedContainers.add(container);
          }
        }
      });
    });
  }

  // 3. 立即启动定时器 (解决 SPA 动态加载问题)
  // Gemini 是动态网页，内容是后来加载的，必须依靠定时器或观察者
  window.__GEMINI_EXPORT_TIMER__ = setInterval(scanAndAddButtons, 1000);
  
  // 4. 尝试立即执行一次 (虽然大概率找不到，但为了保险)
  scanAndAddButtons();

  console.log('✅ Gemini Markdown Exporter 已启动，正在监听内容变化...');

  // === 以下保留原本的 createFloatingButton 及后续辅助函数 ===
  // ... (你的 createFloatingButton, copyToMarkdown 等函数保持不变)
  // === 创建悬浮按钮 ===
  function createFloatingButton(container, index) {
    // 检查是否已经创建过按钮
    if (container.querySelector('.gemini-export-float-btn')) {
      return;
    }

    // 确保容器有相对定位
    const computedStyle = window.getComputedStyle(container);
    if (computedStyle.position === 'static') {
      container.style.position = 'relative';
    }

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'gemini-button-container';
    Object.assign(buttonContainer.style, {
      position: 'absolute',
      top: '-34px',
      right: '16px',
      zIndex: '1000',
      display: 'flex',
      gap: '8px',
    });

    // 创建复制按钮（幽灵按钮）
    const copyBtn = document.createElement('button');
    copyBtn.className = 'gemini-copy-float-btn';

    // 复制图标 SVG
    const copySvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    copySvg.setAttribute("width", "14");
    copySvg.setAttribute("height", "14");
    copySvg.setAttribute("viewBox", "0 0 24 24");
    copySvg.setAttribute("fill", "none");
    copySvg.setAttribute("stroke", "currentColor");
    copySvg.setAttribute("stroke-width", "2.5");
    copySvg.setAttribute("stroke-linecap", "round");
    copySvg.setAttribute("stroke-linejoin", "round");
    copySvg.style.marginRight = "6px";

    const copyRect1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    copyRect1.setAttribute("x", "9");
    copyRect1.setAttribute("y", "9");
    copyRect1.setAttribute("width", "13");
    copyRect1.setAttribute("height", "13");
    copyRect1.setAttribute("rx", "2");
    copyRect1.setAttribute("ry", "2");
    copySvg.appendChild(copyRect1);

    const copyPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    copyPath1.setAttribute("d", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1");
    copySvg.appendChild(copyPath1);

    copyBtn.appendChild(copySvg);

    const copySpan = document.createElement("span");
    copySpan.textContent = "Copy";
    copyBtn.appendChild(copySpan);

    // 检测暗黑模式
    const isDarkMode = document.body.classList.contains('dark-theme');

    // 根据主题设置按钮样式
    const buttonStyles = isDarkMode ? {
      background: 'rgba(30, 30, 30, 0.95)',
      color: '#e2e8f0',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
    } : {
      background: 'rgba(255, 255, 255, 0.95)',
      color: '#1e293b',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
    };

    const hoverStyles = isDarkMode ? {
      background: 'rgba(45, 45, 45, 0.98)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      color: '#ffffff',
    } : {
      background: '#ffffff',
      borderColor: '#cbd5e1',
      color: '#0f172a',
    };

    Object.assign(copyBtn.style, {
      padding: '8px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
      opacity: '0.6',
      ...buttonStyles,
    });

    // 复制按钮悬停效果
    copyBtn.addEventListener('mouseenter', () => {
      Object.assign(copyBtn.style, {
        transform: 'translateY(-1px)',
        boxShadow: isDarkMode
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        opacity: '1',
        ...hoverStyles,
      });
    });

    copyBtn.addEventListener('mouseleave', () => {
      Object.assign(copyBtn.style, {
        transform: 'translateY(0)',
        opacity: '0.6',
        ...buttonStyles,
      });
    });

    // 复制按钮点击事件
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyToMarkdown(container, copyBtn);
    });

    // 创建导出按钮
    const exportBtn = document.createElement('button');
    exportBtn.className = 'gemini-export-float-btn';

    // 使用 SVG 图标使其更美观 (使用 DOM 方法避免 innerHTML TrustedHTML 错误)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2.5");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.style.marginRight = "6px";

    const path1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path1.setAttribute("d", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4");
    svg.appendChild(path1);

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", "7 10 12 15 17 10");
    svg.appendChild(polyline);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "12");
    line.setAttribute("y1", "15");
    line.setAttribute("x2", "12");
    line.setAttribute("y2", "3");
    svg.appendChild(line);

    exportBtn.appendChild(svg);

    const span = document.createElement("span");
    span.textContent = "Export";
    exportBtn.appendChild(span);

    Object.assign(exportBtn.style, {
      padding: '8px 14px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
      opacity: '0.6',
      ...buttonStyles,
    });

    // 导出按钮悬停效果
    exportBtn.addEventListener('mouseenter', () => {
      Object.assign(exportBtn.style, {
        transform: 'translateY(-1px)',
        boxShadow: isDarkMode
          ? '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        opacity: '1',
        ...hoverStyles,
      });
    });

    exportBtn.addEventListener('mouseleave', () => {
      Object.assign(exportBtn.style, {
        transform: 'translateY(0)',
        opacity: '0.6',
        ...buttonStyles,
      });
    });

    // 点击事件 - 执行导出
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exportToMarkdown(container);
    });

    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(exportBtn);
    container.appendChild(buttonContainer);
    console.log(`✅ 悬浮按钮已添加到容器 ${index + 1}`);
  }

  // === 复制为 Markdown ===
  async function copyToMarkdown(target, button) {
    console.log("⏳ 正在复制...");

    const md = htmlToMarkdown(target);

    // 检测是否为中文内容
    const isChineseContent = getChineseRatio(md) > 0.5;

    // 添加仓库推广 footer（根据内容语言自动切换）
    const promo = isChineseContent
      ? `\n\n---\n\n**由 [gemini-to-markdown](https://github.com/faithleysath/gemini-to-markdown) 复制** ⭐\n\n*一个用于将 Gemini Canvas/Deep Research 页面转换为 Markdown 的 JavaScript 工具*\n`
      : `\n\n---\n\n**Copied with [gemini-to-markdown](https://github.com/faithleysath/gemini-to-markdown)** ⭐\n\n*A JavaScript tool to convert Gemini Canvas/Deep Research pages into Markdown*\n`;
    const finalMd = md + promo;

    try {
      // 复制到剪贴板
      await navigator.clipboard.writeText(finalMd);

      console.log(
        "🎉 复制成功！前500字符预览：\n------------------\n",
        finalMd.slice(0, 500),
        "\n\n⭐ Checkout the tool at: https://github.com/faithleysath/gemini-to-markdown"
      );

      // 临时显示成功状态
      const originalText = button.querySelector('span').textContent;
      const checkSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      checkSvg.setAttribute("width", "14");
      checkSvg.setAttribute("height", "14");
      checkSvg.setAttribute("viewBox", "0 0 24 24");
      checkSvg.setAttribute("fill", "none");
      checkSvg.setAttribute("stroke", "#22c55e");
      checkSvg.setAttribute("stroke-width", "3");
      checkSvg.setAttribute("stroke-linecap", "round");
      checkSvg.setAttribute("stroke-linejoin", "round");
      checkSvg.style.marginRight = "6px";

      const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      checkPath.setAttribute("d", "M20 6L9 17l-5-5");
      checkSvg.appendChild(checkPath);

      const oldIcon = button.querySelector('svg');
      button.replaceChild(checkSvg, oldIcon);
      button.querySelector('span').textContent = "Copied!";
      button.style.borderColor = "#22c55e";
      button.style.color = "#22c55e";

      setTimeout(() => {
        button.replaceChild(oldIcon, checkSvg);
        button.querySelector('span').textContent = originalText;
        button.style.borderColor = "rgba(226, 232, 240, 0.8)";
        button.style.color = "#1e293b";
      }, 2000);

    } catch (err) {
      console.error("❌ 复制失败:", err);
      alert("复制失败，请手动复制");
    }
  }

  // === 导出为 Markdown ===
  function exportToMarkdown(target) {
    console.log("⏳ 正在转换...");

    const md = htmlToMarkdown(target);

    // 检测是否为中文内容，用于后续模态框和 footer
    const isChineseContent = getChineseRatio(md) > 0.5;

    // 添加仓库推广 footer（根据内容语言自动切换）
    const promo = isChineseContent
      ? `\n\n---\n\n**由 [gemini-to-markdown](https://github.com/faithleysath/gemini-to-markdown) 导出** ⭐\n\n*一个用于将 Gemini Canvas/Deep Research 页面导出为 Markdown 的 JavaScript 工具*\n`
      : `\n\n---\n\n**Exported with [gemini-to-markdown](https://github.com/faithleysath/gemini-to-markdown)** ⭐\n\n*A JavaScript tool to export Gemini Canvas/Deep Research pages into Markdown*\n`;
    const finalMd = md + promo;

    // 触发下载
    const blob = new Blob([finalMd], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `gemini_export_${timestamp}.md`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(
      "🎉 转换完成！前500字符预览：\n------------------\n",
      finalMd.slice(0, 500),
      "\n\n⭐ Checkout the tool at: https://github.com/faithleysath/gemini-to-markdown"
    );

    // 显示模态框
    showPromoModal(isChineseContent);
  }

  // === 检测中文字符占比 ===
  function getChineseRatio(text) {
    // 匹配中文字符（包括中文标点）
    const chineseRegex = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/g;
    const chineseMatches = text.match(chineseRegex) || [];
    const chineseCount = chineseMatches.length;
    const totalChars = text.replace(/\s/g, "").length; // 移除空白字符
    return totalChars > 0 ? chineseCount / totalChars : 0;
  }

  // === 创建推广模态框 ===
  function showPromoModal(isChinese) {

    // 检测暗黑模式
    const isDarkMode = document.body.classList.contains('dark-theme');

    // 移除已存在的模态框
    const existing = document.getElementById("gemini-md-export-overlay");
    if (existing) existing.remove();

    // 创建遮罩层
    const overlay = document.createElement("div");
    overlay.id = "gemini-md-export-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      backgroundColor: isDarkMode ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      backdropFilter: "blur(5px)",
      animation: "geminiMdFadeIn 0.3s ease-out forwards",
      opacity: "0",
    });

    // 创建模态框
    const modal = document.createElement("div");
    Object.assign(modal.style, {
      backgroundColor: isDarkMode ? "#1e1e1e" : "#ffffff",
      borderRadius: "20px",
      padding: "32px",
      maxWidth: "420px",
      width: "90%",
      boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
      transform: "scale(0.95)",
      opacity: "0",
      animation: "geminiMdSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      textAlign: "center",
      border: isDarkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(255,255,255,0.1)",
    });

    // 添加 CSS 动画与样式
    if (!document.getElementById("gemini-md-styles")) {
      const style = document.createElement("style");
      style.id = "gemini-md-styles";
      style.textContent = `
        @keyframes geminiMdFadeIn { to { opacity: 1; } }
        @keyframes geminiMdFadeOut { to { opacity: 0; } }
        @keyframes geminiMdSlideUp { to { opacity: 1; transform: scale(1); } }
        .gemini-md-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 24px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          text-decoration: none;
          flex: 1;
        }
        .gemini-md-btn:hover { transform: scale(1.05); }
        .gemini-md-btn:active { transform: scale(0.98); }

        .gemini-md-primary {
          background: #1a1f24;
          color: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .gemini-md-primary:hover {
          background: #000000;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.15);
        }

        .gemini-md-secondary {
          background-color: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
        }
        .gemini-md-secondary:hover {
          background-color: #e5e7eb;
          border-color: #d1d5db;
        }

        /* 暗黑模式样式 */
        .dark-theme .gemini-md-secondary {
          background-color: #2d2d2d;
          color: #e5e7eb;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .dark-theme .gemini-md-secondary:hover {
          background-color: #3d3d3d;
          border-color: rgba(255, 255, 255, 0.2);
        }
      `;
      document.head.appendChild(style);
    }

    // 图标
    const icon = document.createElement("div");
    icon.textContent = "✨";
    Object.assign(icon.style, {
      fontSize: "48px",
      marginBottom: "20px",
      display: "inline-block",
      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))",
    });

    // 标题
    const title = document.createElement("h2");
    title.textContent = isChinese ? "导出成功！" : "Export Successful!";
    Object.assign(title.style, {
      margin: "0 0 12px 0",
      color: isDarkMode ? "#f9fafb" : "#111827",
      fontSize: "24px",
      fontWeight: "800",
      letterSpacing: "-0.5px",
    });

    // 副标题
    const subtitle = document.createElement("p");
    if (isChinese) {
      subtitle.append("已保存为 ");
      const b = document.createElement("b");
      b.textContent = "Markdown";
      subtitle.append(b, " 文件");
      subtitle.appendChild(document.createElement("br"));
      const span = document.createElement("span");
      span.textContent = "如果觉得这个工具有用，请给个 Star ⭐";
      Object.assign(span.style, { fontSize: '14px', opacity: '0.6', marginTop: '4px', display: 'block' });
      subtitle.appendChild(span);
    } else {
      subtitle.append("Saved as ");
      const b = document.createElement("b");
      b.textContent = "Markdown";
      subtitle.append(b, " file.");
      subtitle.appendChild(document.createElement("br"));
      const span = document.createElement("span");
      span.textContent = "If you like this tool, give it a star!";
      Object.assign(span.style, { fontSize: '14px', opacity: '0.6', marginTop: '4px', display: 'block' });
      subtitle.appendChild(span);
    }

    Object.assign(subtitle.style, {
      margin: "0 0 32px 0",
      color: isDarkMode ? "#9ca3af" : "#4b5563",
      fontSize: "16px",
      lineHeight: "1.6",
    });

    // 按钮容器
    const btnContainer = document.createElement("div");
    Object.assign(btnContainer.style, {
      display: "flex",
      gap: "12px",
      justifyContent: "center",
      width: "100%",
    });

    // GitHub Star 按钮
    const githubBtn = document.createElement("a");
    githubBtn.href = "https://github.com/faithleysath/gemini-to-markdown";
    githubBtn.target = "_blank";
    githubBtn.className = "gemini-md-btn gemini-md-primary";

    // Create SVG manually to avoid innerHTML
    const ghSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    ghSvg.setAttribute("width", "20");
    ghSvg.setAttribute("height", "20");
    ghSvg.setAttribute("fill", "currentColor");
    ghSvg.setAttribute("viewBox", "0 0 16 16");
    const ghPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    ghPath.setAttribute("d", "M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z");
    ghSvg.appendChild(ghPath);
    githubBtn.appendChild(ghSvg);
    githubBtn.appendChild(document.createTextNode(isChinese ? " 给个 Star" : " Star GitHub"));

    // 关闭按钮
    const closeBtn = document.createElement("button");
    closeBtn.className = "gemini-md-btn gemini-md-secondary";

    // Create SVG manually to avoid innerHTML
    const closeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    closeSvg.setAttribute("width", "20");
    closeSvg.setAttribute("height", "20");
    closeSvg.setAttribute("fill", "none");
    closeSvg.setAttribute("stroke", "currentColor");
    closeSvg.setAttribute("stroke-width", "2");
    closeSvg.setAttribute("viewBox", "0 0 24 24");
    const closePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    closePath.setAttribute("stroke-linecap", "round");
    closePath.setAttribute("stroke-linejoin", "round");
    closePath.setAttribute("d", "M6 18L18 6M6 6l12 12");
    closeSvg.appendChild(closePath);
    closeBtn.appendChild(closeSvg);
    closeBtn.appendChild(document.createTextNode(isChinese ? " 关闭" : " Close"));

    btnContainer.appendChild(githubBtn);
    btnContainer.appendChild(closeBtn);

    modal.appendChild(icon);
    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 关闭逻辑
    const closeModal = () => {
      // 修复关闭动画失效问题：
      // 替换 animation 时，上一动画 forwards 状态会丢失，导致瞬间回退到初始 opacity: 0
      // 必须显式设置当前状态为 1，作为 fadeOut 的起点
      overlay.style.opacity = "1";
      overlay.style.animation = "geminiMdFadeOut 0.2s ease forwards";
      setTimeout(() => overlay.remove(), 200);
    };

    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  }
})();
