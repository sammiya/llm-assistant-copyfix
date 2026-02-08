(function installCopyFix() {
  const HANDLER_KEY = "__llm_assistant_copyfix_copy_handler__";

  function getTargetSite() {
    const host = window.location.hostname;
    if (host === "chatgpt.com") return "chatgpt";
    if (host === "gemini.google.com") return "gemini";
    if (host === "claude.ai") return "claude";
    return null;
  }

  function getSelectionContext() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const ancestor =
      container.nodeType === Node.ELEMENT_NODE
        ? container
        : container.parentElement;

    if (!ancestor) return null;
    return { sel, range, ancestor };
  }

  function overwriteClipboard(text, scopeLabel) {
    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText(text);
      } catch (err) {
        console.error(
          `[llm-assistant-copyfix:${scopeLabel}] Failed to overwrite clipboard:`,
          err
        );
      }
    }, 0);
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function buildHtmlFromPlainText(text) {
    return text
      .split("\n")
      .map((line) => {
        if (line === "") return "<p><br></p>";
        return `<p>${escapeHtml(line)}</p>`;
      })
      .join("");
  }

  function applyClaudeClipboardData(event, text) {
    if (!event || !event.clipboardData) return false;
    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
    event.clipboardData.setData("text/html", buildHtmlFromPlainText(text));
    return true;
  }

  function buildGeminiCorrectText(range, queryTextEl) {
    const pElements = Array.from(queryTextEl.querySelectorAll("p.query-text-line"));
    if (pElements.length === 0) return null;

    const lines = [];
    for (const p of pElements) {
      if (!range.intersectsNode(p)) continue;

      const hasBrOnly = p.querySelector("br") !== null && p.textContent.trim() === "";
      if (hasBrOnly) {
        lines.push("");
        continue;
      }

      let text = p.textContent.trim();
      const pContainsStart = p.contains(range.startContainer);
      const pContainsEnd = p.contains(range.endContainer);

      if (pContainsStart && pContainsEnd) {
        const tempRange = document.createRange();
        tempRange.setStart(range.startContainer, range.startOffset);
        tempRange.setEnd(range.endContainer, range.endOffset);
        text = tempRange.toString();
      } else if (pContainsStart) {
        const tempRange = document.createRange();
        tempRange.setStart(range.startContainer, range.startOffset);
        tempRange.setEndAfter(p.lastChild || p);
        text = tempRange.toString().trimEnd();
      } else if (pContainsEnd) {
        const tempRange = document.createRange();
        tempRange.setStartBefore(p.firstChild || p);
        tempRange.setEnd(range.endContainer, range.endOffset);
        text = tempRange.toString().trimStart();
      }

      lines.push(text);
    }

    if (lines.length === 0) return null;
    return lines.join("\n");
  }

  function getLastNonEmptyLine(lines) {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      if (lines[i].length > 0) return lines[i];
    }
    return "";
  }

  function replaceUserTextInFull(fullText, correctUserText) {
    const lines = correctUserText.split("\n");
    const wrongPattern = lines.join("\n\n");

    const patternIndex = fullText.indexOf(wrongPattern);
    if (patternIndex !== -1) {
      return (
        fullText.substring(0, patternIndex) +
        correctUserText +
        fullText.substring(patternIndex + wrongPattern.length)
      );
    }

    const firstLine = lines.find((line) => line.length > 0) || "";
    const lastLine = getLastNonEmptyLine(lines);
    const startIndex = fullText.indexOf(firstLine);
    const endIndex = fullText.lastIndexOf(lastLine);

    if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
      return (
        fullText.substring(0, startIndex) +
        correctUserText +
        fullText.substring(endIndex + lastLine.length)
      );
    }

    return fullText;
  }

  function getChatGPTReplacement(sel, ancestor) {
    const isUserMessage =
      ancestor.closest(".whitespace-pre-wrap") !== null ||
      ancestor.querySelector?.(".whitespace-pre-wrap") !== null;
    if (!isUserMessage) return null;

    return sel.toString();
  }

  function getGeminiReplacement(sel, range, ancestor) {
    const queryTextEl =
      ancestor.closest?.(".query-text") || ancestor.querySelector?.(".query-text");
    if (!queryTextEl) return null;

    const correctUserText = buildGeminiCorrectText(range, queryTextEl);
    if (correctUserText === null) return null;

    const queryTextRange = document.createRange();
    queryTextRange.selectNodeContents(queryTextEl);

    const selStartBeforeQuery =
      range.compareBoundaryPoints(Range.START_TO_START, queryTextRange) < 0;
    const selEndAfterQuery =
      range.compareBoundaryPoints(Range.END_TO_END, queryTextRange) > 0;

    if (!selStartBeforeQuery && !selEndAfterQuery) {
      return correctUserText;
    }

    const fullText = sel.toString();
    return replaceUserTextInFull(fullText, correctUserText);
  }

  function getClaudeReplacement(sel, ancestor) {
    const isUserMessage =
      ancestor.closest('[data-testid="user-message"]') !== null ||
      ancestor.querySelector?.('[data-testid="user-message"]') !== null;
    if (!isUserMessage) return null;

    return sel.toString();
  }

  if (window[HANDLER_KEY]) {
    document.removeEventListener("copy", window[HANDLER_KEY], true);
  }

  window[HANDLER_KEY] = (event) => {
    const site = getTargetSite();
    if (!site) return;

    const context = getSelectionContext();
    if (!context) return;

    const { sel, range, ancestor } = context;

    let replacementText = null;
    if (site === "chatgpt") {
      replacementText = getChatGPTReplacement(sel, ancestor);
    } else if (site === "gemini") {
      replacementText = getGeminiReplacement(sel, range, ancestor);
    } else if (site === "claude") {
      replacementText = getClaudeReplacement(sel, ancestor);
    }

    if (typeof replacementText !== "string") return;

    if (site === "claude") {
      const applied = applyClaudeClipboardData(event, replacementText);
      if (!applied) {
        overwriteClipboard(replacementText, "claude-fallback");
      }
      return;
    }

    overwriteClipboard(replacementText, site);
  };

  document.addEventListener("copy", window[HANDLER_KEY], true);
})();
