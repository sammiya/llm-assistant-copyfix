# llm-assistant-copyfix

A Chrome extension that preserves line breaks when copying messages in LLM chats. Currently supports ChatGPT (`chatgpt.com`) only.

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

1. Open `https://chatgpt.com`
2. Open a conversation that contains user messages with multiple lines
3. Select text in a user message and copy it with `Cmd+C` / `Ctrl+C`
4. Paste into a plain-text editor
5. Confirm line breaks are preserved

## Security and Disclaimer

- Use at your own risk. The author is not responsible for any damages caused by using this extension.

## For Developers

See `DEVELOPMENT.md` for implementation details and verification procedures.

## License

MIT
