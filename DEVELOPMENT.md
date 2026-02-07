# Development Notes: Fix Lost Newlines When Copying ChatGPT User Messages

## 1. Context

On `chatgpt.com`, copying text from a user message (`Cmd+C` / `Ctrl+C`) can collapse line breaks into spaces when pasted into plain-text apps. This extension exists to preserve those line breaks.

## 2. Current Observations

### 2.1 Symptom

When text is copied from a user message and pasted into a plain-text app, line breaks are flattened and the text becomes a single line.

### 2.2 Root Cause (Current DOM/Behavior)

ChatGPT attaches a single React `onCopy` handler to the conversation container (`.flex.flex-col.text-sm.pb-25`). The same handler is used for both user and assistant messages.

The handler calls `e.preventDefault()` and writes custom `text/plain` / `text/html` to `clipboardData`. Its plain-text generation is based on HTML block boundaries (`<p>`, `<br>`, etc.) and normalizes raw `\n` in text nodes into spaces.

Assistant messages are HTML-structured (`<p>`, `<br>`, etc.), so plain-text line breaks are reconstructed correctly. User messages rely on CSS `white-space: pre-wrap` with raw `\n` text nodes and no structural HTML tags, so line breaks are lost.

### 2.3 DOM Structure Snapshot

```
Conversation container (single onCopy handler here)
+-- article (conversation-turn-N) User message
|   +-- <div class="whitespace-pre-wrap">
|       Text node: "AAA\nBBB\n\nCCC"  <- no HTML tags, raw \n
|
+-- article (conversation-turn-N) Assistant message
    +-- <div class="markdown">
        <p>AAA<br>BBB</p><p>CCC</p>     <- structured by HTML tags
```

### 2.4 Copy Result Snapshot

| | User message | Assistant message |
|---|---|---|
| `text/plain` | No: line breaks replaced by spaces | Yes: line breaks preserved |
| `text/html` | Yes: line breaks preserved | Yes: line breaks preserved |

## 3. Current Fix Approach

- Capture `selection.toString()` during the `copy` capture phase.
- After ChatGPT's `onCopy` runs, overwrite the clipboard using `navigator.clipboard.writeText()`.
- Apply only when the selected range includes user-message content (`.whitespace-pre-wrap`).
- Do not rewrite the DOM and do not disable ChatGPT's handler.

## 4. Source of Truth

- Runtime behavior: `content.js`
- Extension config / match scope / permissions: `manifest.json`
- This file: rationale, findings, and verification notes

## 5. Verification

### 5.1 Preconditions

Open a `chatgpt.com` conversation page that contains a user message with line breaks.

### 5.2 Steps

1. Select text from a user message and copy with `Cmd+C` / `Ctrl+C`.
2. Paste into a plain-text editor.
3. Confirm line breaks are preserved.

### 5.3 Additional Checks

- Copy assistant-message text only: behavior remains unchanged.
- Copy a range spanning user and assistant messages: line breaks remain preserved.

## 6. Investigation Scripts

Run in browser developer tools console.

### 6.1 Locate `onCopy` Handler

```js
document.querySelectorAll("*").forEach((el) => {
  const reactPropsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  if (!reactPropsKey) return;
  const props = el[reactPropsKey];
  if (!props?.onCopy) return;
  const articles = el.querySelectorAll("article");
  console.log("onCopy handler found on:", el.tagName, el.className.substring(0, 80));
  console.log("contains articles:", articles.length);
  articles.forEach((a) => {
    const role = a.querySelector("[data-message-author-role]")
      ?.getAttribute("data-message-author-role");
    console.log(`  - ${a.getAttribute("data-testid")}: ${role}`);
  });
});
```

### 6.2 Compare User vs Assistant Copy Results

```js
function testCopy(label, element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const event = new ClipboardEvent("copy", {
    bubbles: true,
    cancelable: true,
    clipboardData: new DataTransfer(),
  });
  element.dispatchEvent(event);
  sel.removeAllRanges();
  const plain = event.clipboardData.getData("text/plain");
  console.group(`=== ${label} ===`);
  console.log("text/plain newlines:", (plain.match(/\\n/g) || []).length);
  console.log("text/plain preview:", JSON.stringify(plain.substring(0, 150)));
  console.groupEnd();
}
const userEl = document.querySelector(
  'article[data-testid="conversation-turn-1"] .whitespace-pre-wrap'
);
const assistantEl = document.querySelector(
  'article[data-testid="conversation-turn-2"] .markdown'
);
if (userEl) testCopy("User Message", userEl);
if (assistantEl) testCopy("Assistant Message", assistantEl);
```
