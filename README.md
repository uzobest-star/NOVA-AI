# NOVA AI Chatbot

NOVA is a modern chatbot interface connected to an AI model through a local Node.js backend. The browser never receives your API key; the key is read only by `server.js` from your local `.env` file.

## What you need

- A laptop or desktop computer
- Node.js 20 or newer (no extra npm packages are required)
- An API key and an account with API access/available quota
- An internet connection for the AI replies

**Cost note:** ChatGPT access and API usage are separate. API calls may be billed by the provider. Review your account's pricing and usage limits before using it. If you're under 18, ask a parent or guardian to help with any account or billing setup. Do not share your API key with anyone.

## Windows setup

1. Install Node.js (LTS) from https://nodejs.org/ if it is not already installed.
2. Extract the ZIP to a folder you can find again, such as `Documents\NOVA`.
3. Open that folder in File Explorer. Copy `.env.example` and rename the copy to `.env`.
   - If Windows hides file extensions, use File Explorer → View → Show → File name extensions so you can see the full name.
4. Open `.env` in Notepad. Replace `put_your_api_key_here` with your private API key. Keep the key on the same line after `OPENAI_API_KEY=`. Save the file.
5. In the NOVA folder, click the address bar in File Explorer, type `cmd`, and press Enter.
6. In the terminal window, run:

   ```bash
   npm install
   npm start
   ```

7. When the terminal says NOVA is running, open Chrome and visit **http://127.0.0.1:3000**.
8. Keep the terminal window open while you use NOVA. To stop the server, click the terminal and press `Ctrl+C`.

## If it does not work

- **Setup needed:** Make sure the file is named `.env` (not `.env.example.txt`) and contains your key.
- **API key rejected:** Check that you copied the key correctly. Do not paste the key into chat or send it to anyone.
- **Quota or rate limit:** Check your provider account's API usage, billing, and limits. A ChatGPT subscription by itself does not necessarily pay for API calls.
- **Model not found/access denied:** Edit `OPENAI_MODEL` in `.env` to a model enabled for your API account, then stop and restart the server.
- **Server not running:** Check the terminal for errors and confirm Node.js is installed with `node --version`.

## Security notes

- `.env` is excluded by `.gitignore`. Do not upload or share it.
- This starter server binds to `127.0.0.1`, so it is for local use on your own computer, not public hosting.
- The backend has simple per-IP rate limiting and checks message sizes. If you deploy it publicly, add stronger abuse protection, user authentication, usage controls, and secure hosting configuration.
- Chat context is sent to the AI provider to generate replies. Do not send passwords, payment details, API keys, or other sensitive information.
