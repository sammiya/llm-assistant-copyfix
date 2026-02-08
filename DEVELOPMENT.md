# Development Notes: Copy Line-Break Fixes for ChatGPT, Gemini, and Claude

## 1. Scope

This extension addresses copy-related line-break issues in three web apps:

- ChatGPT (`chatgpt.com`): user-message line breaks can collapse into spaces.
- Gemini (`gemini.google.com`): user-message line breaks can be doubled.
- Claude (`claude.ai`): rich-text pastes can collapse in-paragraph newlines into spaces.

## 2. ChatGPT Notes

### 2.1 Symptom

Copying text from a user message and pasting into a plain-text app can flatten line breaks into spaces.

### 2.2 Root Cause (Current Observation)

ChatGPT uses a React `onCopy` handler on the conversation container (`.flex.flex-col.text-sm.pb-25`).
The same handler processes both user and assistant content.

The handler calls `e.preventDefault()` and writes custom `text/plain` and `text/html`. In that custom plain-text logic, raw `\n` inside text nodes can be normalized to spaces.

### 2.3 Relevant DOM Snapshot

```
Conversation container (single onCopy handler)
+-- article (conversation-turn-N) User message
|   +-- <div class="whitespace-pre-wrap">
|       Text node: "AAA\nBBB\n\nCCC"
|
+-- article (conversation-turn-N) Assistant message
    +-- <div class="markdown">
        <p>AAA<br>BBB</p><p>CCC</p>
```

### 2.4 ChatGPT Fix Strategy

If selection includes `.whitespace-pre-wrap`, use `selection.toString()` and overwrite clipboard after default/captured copy flow.
For user-only selections (start/end inside the same user block), attempt to write both `text/plain` and generated `text/html`.
For mixed selections (user + assistant), write plain text only to avoid interfering with assistant formatting behavior.

## 3. Gemini Notes

### 3.1 Symptom

Copying text from a user message and pasting into a plain-text app can double line breaks.
Single line breaks become `\n\n`; an empty line can become `\n\n\n\n`.

### 3.2 Root Cause (Current Observation)

Gemini does not rely on a custom copy handler for this behavior. The issue comes from DOM structure and browser default copy semantics.

User message lines are represented as `<p class="query-text-line">` nodes under `.query-text`. Browser copy behavior treats `<p>` boundaries as paragraph boundaries and inserts extra newlines.

### 3.3 Relevant DOM Snapshot

```
<div class="query-text gds-body-l" role="heading">
  <p class="query-text-line">line A</p>
  <p class="query-text-line">line B</p>
  <p class="query-text-line"><br></p>
  <p class="query-text-line">line C</p>
</div>
```

### 3.4 Gemini Fix Strategy

- Build corrected user text by traversing `p.query-text-line` within selection.
- Treat `<br>`-only paragraphs as empty lines.
- For cross-selection (user + assistant), replace only the Gemini user segment inside `selection.toString()`.
- For user-only selections, attempt to write both `text/plain` and generated `text/html`.

## 4. Claude Notes

### 4.1 Symptom

When copying user messages in Claude, `text/plain` is usually correct, but rich-text pastes can lose in-paragraph newlines.

### 4.2 Root Cause (Current Observation)

Claude user messages can contain literal `\n` characters inside `<p>` nodes (`.whitespace-pre-wrap break-words`).
Default copied `text/html` can keep those literal newlines without `<br>`. In rich-text editors, HTML whitespace handling can turn those newlines into spaces.

### 4.3 Relevant DOM Snapshot

```
<div data-testid="user-message" style="display:grid; gap:8px">
  <p class="whitespace-pre-wrap break-words">line A\nline B</p>
  <p class="whitespace-pre-wrap break-words">line C</p>
</div>
```

### 4.4 Claude Fix Strategy

- Intervene only when selection includes `[data-testid="user-message"]`.
- Use copy event data directly: `event.preventDefault()` + `event.clipboardData.setData(...)`.
- Set both `text/plain` and `text/html`.
- Generate HTML from plain text by mapping lines to `<p>...</p>` and empty lines to `<p><br></p>`.

## 5. Runtime Strategy

A single capture-phase `copy` listener (`content.js`) handles all supported sites.

- Detect site by `location.hostname`.
- ChatGPT path: overwrite clipboard for user selections; user-only selections use rich write (`text/plain` + generated `text/html`) when possible.
- Gemini path: rebuild user text from `p.query-text-line`; write through copy-event `clipboardData` (`text/plain` + generated `text/html` for user-only selections, plain text only for mixed selections).
- Claude path: prevent default copy and set both `text/plain` and `text/html` in the copy event.
- Do not rewrite DOM.
- Do not modify assistant-only selections.

## 6. Source of Truth

- Runtime behavior: `content.js`
- Extension config and URL matching: `manifest.json`
- This file: rationale, observations, and verification checklist

## 7. Verification Checklist

### 7.1 ChatGPT

- Copy user message with multiple lines -> line breaks remain intact.
- Copy assistant-only content -> behavior unchanged.
- Copy a range spanning user + assistant -> user-message line breaks remain intact.

### 7.2 Gemini

- Copy full user message -> single line breaks are `\n`, empty lines are `\n\n`.
- Copy partial range across multiple user lines -> expected line breaks.
- Copy assistant-only content -> behavior unchanged.
- Copy single word from user message -> unchanged.
- Copy range spanning user + assistant -> user part corrected, assistant part unchanged.

### 7.3 Claude

- Copy user message with multiple lines and empty lines -> rich-text paste preserves both line breaks and empty lines.
- Copy partial user selection -> line breaks remain intact.
- Copy single word from user message -> unchanged.
- Copy assistant-only content -> behavior unchanged.
- Copy range spanning user + assistant -> full pasted content keeps expected line structure.
- Copy user message and paste into plain-text editor -> line breaks remain intact.

## 8. Investigation Snippets

Run in browser developer tools console as needed.

### 8.1 ChatGPT: Locate `onCopy` handler

```js
document.querySelectorAll("*").forEach((el) => {
  const reactPropsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  if (!reactPropsKey) return;
  const props = el[reactPropsKey];
  if (!props?.onCopy) return;
  console.log("onCopy handler found:", el.tagName, el.className);
});
```

### 8.2 Gemini: Inspect user line nodes

```js
const userBlocks = document.querySelectorAll(".query-text");
console.log("query-text count:", userBlocks.length);
if (userBlocks[0]) {
  const lines = userBlocks[0].querySelectorAll("p.query-text-line");
  console.log("query-text-line count:", lines.length);
  lines.forEach((line, i) => console.log(i, JSON.stringify(line.textContent)));
}
```

### 8.3 Claude: Inspect user message blocks

```js
const blocks = document.querySelectorAll('[data-testid="user-message"]');
console.log("user-message blocks:", blocks.length);
if (blocks[0]) {
  const ps = blocks[0].querySelectorAll("p.whitespace-pre-wrap");
  console.log("paragraph count:", ps.length);
  ps.forEach((p, i) => console.log(i, JSON.stringify(p.textContent)));
}
```
