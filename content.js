(function installFixCopy() {
  const HANDLER_KEY = "__llm_assistant_copyfix_copy_handler__";

  if (window[HANDLER_KEY]) {
    document.removeEventListener("copy", window[HANDLER_KEY], true);
  }

  window[HANDLER_KEY] = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const ancestor =
      container.nodeType === Node.ELEMENT_NODE
        ? container
        : container.parentElement;

    if (!ancestor) return;

    const isUserMessage =
      ancestor.closest(".whitespace-pre-wrap") !== null ||
      ancestor.querySelector?.(".whitespace-pre-wrap") !== null;

    if (!isUserMessage) return;

    const correctText = sel.toString();

    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText(correctText);
      } catch (err) {
        console.error("[FixCopy] Failed to overwrite clipboard:", err);
      }
    }, 0);
  };

  document.addEventListener("copy", window[HANDLER_KEY], true);
})();
