(function () {
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
  // 自动寻找所有可能的容器
  const selectors = [
    ".markdown",
    ".ProseMirror",
    ".model-response-text",
    "markdown-viewer"
  ];

  const targets = [];
  selectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(el => {
      if (!targets.includes(el)) {
        targets.push(el);
      }
    });
  });

  if (targets.length === 0) {
    console.error(
      "❌ 未找到常见的内容容器 (.markdown, .ProseMirror, .model-response-text)。请手动修改代码中的 target 变量。",
    );
    return;
  }

  console.log(`✅ 找到 ${targets.length} 个目标容器`, targets);

  // 在每个目标容器上添加悬浮按钮
  targets.forEach((target, index) => {
    createFloatingButton(target, index);
  });

  // === 启动全局定时器，动态扫描并添加按钮 ===
  let processedContainers = new WeakSet(); // 用于追踪已处理过的容器

  function scanAndAddButtons() {
    // 扫描所有目标选择器
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(container => {
        // 如果该容器未处理过，则添加按钮
        if (!processedContainers.has(container)) {
          // 检查是否已有按钮，避免重复添加
          if (!container.querySelector('.gemini-export-float-btn')) {
            createFloatingButton(container, processedContainers.size);
            processedContainers.add(container);
          }
        }
      });
    });
  }

  // 每500ms扫描一次
  setInterval(scanAndAddButtons, 500);

  console.log('✅ 已启动全局扫描器，每500ms扫描一次目标容器');

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

    // 创建悬浮按钮
    const btn = document.createElement('button');
    btn.className = 'gemini-export-float-btn';

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

    btn.appendChild(svg);

    const span = document.createElement("span");
    span.textContent = "Markdown";
    btn.appendChild(span);

    Object.assign(btn.style, {
      position: 'absolute',
      top: '-34px',
      right: '16px',
      zIndex: '1000',
      padding: '8px 14px',
      background: 'rgba(255, 255, 255, 0.95)',
      color: '#1e293b',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: '600',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      display: 'flex',
      alignItems: 'center',
      backdropFilter: 'blur(4px)',
      opacity: '0.6', // 默认半透明，减少干扰
    });

    // 悬停效果
    btn.addEventListener('mouseenter', () => {
      Object.assign(btn.style, {
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        opacity: '1',
        background: '#ffffff',
        borderColor: '#cbd5e1',
        color: '#0f172a',
      });
    });

    btn.addEventListener('mouseleave', () => {
      Object.assign(btn.style, {
        transform: 'translateY(0)',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
        opacity: '0.6',
        background: 'rgba(255, 255, 255, 0.95)',
        borderColor: 'rgba(226, 232, 240, 0.8)',
        color: '#1e293b',
      });
    });

    // 点击事件 - 执行导出
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      exportToMarkdown(container);
    });

    container.appendChild(btn);
    console.log(`✅ 悬浮按钮已添加到容器 ${index + 1}`);
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
      backgroundColor: "rgba(0, 0, 0, 0.6)",
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
      backgroundColor: "#ffffff",
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
      border: "1px solid rgba(255,255,255,0.1)",
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

        .gemini-md-danger {
          background-color: #fef2f2;
          color: #dc2626;
          border: 1px solid #fee2e2;
        }
        .gemini-md-danger:hover {
          background-color: #fee2e2;
          border-color: #fecaca;
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
      color: "#111827",
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
      color: "#4b5563",
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
    closeBtn.className = "gemini-md-btn";

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
      overlay.style.animation = "geminiMdFadeOut 0.2s ease forwards";
      setTimeout(() => overlay.remove(), 200);
    };

    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  }
})();
