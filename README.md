# llm-assistant-copyfix

A Chrome extension that preserves line breaks when copying messages in LLM chats. Supports ChatGPT (`chatgpt.com`), Gemini (`gemini.google.com`), and Claude (`claude.ai`).

## Install

### Requirements

- Google Chrome

### Steps

1. Clone or download this repository

```bash
git clone https://github.com/sammiya/llm-assistant-copyfix.git
```

2. Open `chrome://extensions`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the `llm-assistant-copyfix` folder
6. The extension should now appear in the list

## Usage

1. Open one supported site: `https://chatgpt.com`, `https://gemini.google.com`, or `https://claude.ai`.
2. Open a conversation with a user message that includes multiple lines.
3. Select text in the user message and copy it with `Cmd+C` / `Ctrl+C`.
4. Paste into a target editor.
5. Verify expected output: ChatGPT keeps line breaks (not collapsed into spaces), Gemini keeps line breaks without doubling, and Claude rich-text paste keeps both line breaks and empty lines.

## Known Limitations

- On ChatGPT and Gemini, rich `text/html` clipboard data is only generated for user-only selections. Mixed selections (user + assistant) are plain-text only to avoid breaking assistant formatting.
- On ChatGPT, rich clipboard writing depends on `navigator.clipboard.write`. If unavailable, the extension falls back to plain-text writing only.

## Security and Disclaimer

- Use at your own risk. The author is not responsible for any damages caused by using this extension.

## For Developers

See `DEVELOPMENT.md` for implementation details and verification procedures.

## License

MIT
