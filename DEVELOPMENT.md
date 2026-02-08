# Development Notes: Copy Line-Break Fixes for ChatGPT and Gemini

## 1. Scope

This extension addresses copy-related line-break issues in two web apps:

- ChatGPT (`chatgpt.com`): user-message line breaks can collapse into spaces.
- Gemini (`gemini.google.com`): user-message line breaks can be doubled.

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

## 4. Runtime Strategy

A single capture-phase `copy` listener (`content.js`) handles both sites.

- Detect site by `location.hostname`.
- ChatGPT path: preserve user text with `selection.toString()` when `.whitespace-pre-wrap` is included.
- Gemini path: reconstruct user text from `p.query-text-line`, then merge for cross-selections.
- Do not rewrite DOM.
- Do not modify assistant-only selections.

## 5. Source of Truth

- Runtime behavior: `content.js`
- Extension config and URL matching: `manifest.json`
- This file: rationale, observations, and verification checklist

## 6. Verification Checklist

### 6.1 ChatGPT

- Copy user message with multiple lines -> line breaks remain intact.
- Copy assistant-only content -> behavior unchanged.
- Copy a range spanning user + assistant -> user-message line breaks remain intact.

### 6.2 Gemini

- Copy full user message -> single line breaks are `\n`, empty lines are `\n\n`.
- Copy partial range across multiple user lines -> expected line breaks.
- Copy assistant-only content -> behavior unchanged.
- Copy single word from user message -> unchanged.
- Copy range spanning user + assistant -> user part corrected, assistant part unchanged.

## 7. Investigation Snippets

Run in browser developer tools console as needed.

### 7.1 ChatGPT: Locate `onCopy` handler

```js
document.querySelectorAll("*").forEach((el) => {
  const reactPropsKey = Object.keys(el).find((k) => k.startsWith("__reactProps"));
  if (!reactPropsKey) return;
  const props = el[reactPropsKey];
  if (!props?.onCopy) return;
  console.log("onCopy handler found:", el.tagName, el.className);
});
```

### 7.2 Gemini: Inspect user line nodes

```js
const userBlocks = document.querySelectorAll(".query-text");
console.log("query-text count:", userBlocks.length);
if (userBlocks[0]) {
  const lines = userBlocks[0].querySelectorAll("p.query-text-line");
  console.log("query-text-line count:", lines.length);
  lines.forEach((line, i) => console.log(i, JSON.stringify(line.textContent)));
}
```
