'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HOST = '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MAX_BODY_BYTES = 40 * 1024;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
const rateBuckets = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

// Send JSON responses.
function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer'
  });

  res.end(JSON.stringify(payload));
}

// Read JSON request bodies.
function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    let finished = false;

    req.on('data', chunk => {
      size += chunk.length;

      if (size > MAX_BODY_BYTES) {
        finished = true;
        reject(
          Object.assign(new Error('Request is too large.'), {
            statusCode: 413
          })
        );

        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (finished) return;

      try {
        resolve(
          JSON.parse(
            Buffer.concat(chunks).toString('utf8') || '{}'
          )
        );
      } catch {
        reject(
          Object.assign(
            new Error('Request body must be valid JSON.'),
            { statusCode: 400 }
          )
        );
      }
    });

    req.on('error', error => {
      if (!finished) reject(error);
    });
  });
}

// Limit repeated requests.
function rateLimited(req) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'local';

  let bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    bucket = {
      startedAt: now,
      count: 0
    };

    rateBuckets.set(key, bucket);
  }

  bucket.count += 1;

  return bucket.count > RATE_LIMIT;
}

// Free, rule-based replies.
// These do not require an API key or internet connection.
function localReply(message) {
  const text = message.toLowerCase().trim();

  if (/^(hi|hello|hey|hiya)\b/.test(text)) {
    return "Hey! 👋 I'm NOVA, your personal assistant. What can I help you with today?";
  }

  if (/good morning/.test(text)) {
    return 'Good morning! ☀️ Welcome to NOVA. What would you like to learn today?';
  }

  if (/good afternoon/.test(text)) {
    return 'Good afternoon! 😎 Welcome to NOVA. How can I help you?';
  }

  if (/good evening/.test(text)) {
    return 'Good evening! 🌙 What can I help you with?';
  }

  if (
    text.includes('your name') ||
    text.includes('who are you')
  ) {
    return "I'm NOVA 🤖, your personal chatbot. I'm currently running in free local demo mode.";
  }

  if (
    text.includes('how are you') ||
    text.includes("how's it going")
  ) {
    return "I'm running smoothly! 😊 Thanks for asking. What would you like to talk about?";
  }

  if (
    text.includes('html') &&
    text.includes('css') &&
    text.includes('javascript')
  ) {
    return 'HTML builds the structure of a webpage, CSS styles it, and JavaScript makes it interactive. Together, they are the foundation of many websites!';
  }

  if (text.includes('html')) {
    return 'HTML stands for HyperText Markup Language. It structures webpages using elements such as headings, paragraphs, images, links, and buttons.';
  }

  if (text.includes('css')) {
    return 'CSS stands for Cascading Style Sheets. It controls a webpage’s appearance, including colours, spacing, layouts, fonts, and animations.';
  }

  if (text.includes('javascript')) {
    return 'JavaScript makes webpages interactive. You can use it to respond to button clicks, validate forms, build games, and create chat interfaces.';
  }

  if (
    text.includes('programming') ||
    text.includes('coding') ||
    text.includes('programmer')
  ) {
    return '💻 A great way to learn programming is to build small projects. Start with HTML for structure, CSS for styling, and JavaScript for functionality. Then practise by improving your projects.';
  }

  if (
    text.includes('website') ||
    text.includes('web development')
  ) {
    return 'To build a website, start with HTML, add CSS for the design, and use JavaScript for interactive features. You can run your project locally and test it in your browser.';
  }

  if (
    text.includes('chatbot') ||
    text.includes('artificial intelligence') ||
    text.includes(' ai ')
  ) {
    return 'A chatbot is a program that communicates with users through messages. This version of NOVA uses predefined rules and replies. A generative AI chatbot needs an AI model to produce more flexible answers.';
  }

  if (
    text.includes('help') ||
    text.includes('what can you do')
  ) {
    return 'I can demonstrate basic coding topics, explain HTML, CSS, and JavaScript, and respond to some common messages. This free demo has limited, predefined responses.';
  }

  if (
    text.includes('thank you') ||
    text.includes('thanks')
  ) {
    return "You're welcome! 😎 I'm happy to help. Try asking me about HTML, CSS, or JavaScript.";
  }

  if (
    text.includes('joke') ||
    text.includes('make me laugh')
  ) {
    return '😂 Why do programmers prefer dark mode? Because light attracts bugs!';
  }

  if (text.includes('free')) {
    return 'NOVA’s local demo is free to run on your computer and does not require an API key. Its replies are limited because it does not use a real AI model.';
  }

  if (text.includes('game')) {
    return 'You can build browser games using HTML, CSS, and JavaScript. Good beginner projects include a number guessing game, a quiz, or a simple clicker game.';
  }

  if (
    text.includes('bye') ||
    text.includes('goodbye')
  ) {
    return 'Goodbye! 👋 Thanks for chatting with NOVA. Come back whenever you want to test the demo.';
  }

  return `You said: "${message}" 😊

I'm NOVA's free local demo. I don't have a real AI model connected, so I can only respond to certain topics.

Try asking about:
• HTML
• CSS
• JavaScript
• Programming
• Chatbots
• Website development

You can connect a real AI model later for more flexible conversations.`;
}

// Handle chatbot messages.
async function handleChat(req, res) {
  if (rateLimited(req)) {
    return sendJson(res, 429, {
      error: 'Too many messages. Please wait one minute and try again.'
    });
  }

  let body;

  try {
    body = await readJson(req);
  } catch (error) {
    return sendJson(res, error.statusCode || 400, {
      error: error.message || 'Could not read request.'
    });
  }

  if (
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return sendJson(res, 400, {
      error: 'Send at least one chat message.'
    });
  }

  const messages = body.messages.slice(-20);
  const cleanMessages = [];

  for (const message of messages) {
    if (
      !message ||
      !['user', 'assistant'].includes(message.role) ||
      typeof message.content !== 'string'
    ) {
      return sendJson(res, 400, {
        error: 'Each message must have a valid role and text content.'
      });
    }

    const content = message.content.trim();

    if (!content || content.length > 4000) {
      return sendJson(res, 400, {
        error: 'Messages must contain 1–4,000 characters.'
      });
    }

    cleanMessages.push({
      role: message.role,
      content
    });
  }

  const lastMessage = cleanMessages[cleanMessages.length - 1];

  if (lastMessage.role !== 'user') {
    return sendJson(res, 400, {
      error: 'The latest message must be from the user.'
    });
  }

  // Respond locally without an API key.
  const reply = localReply(lastMessage.content);

  return sendJson(res, 200, {
    reply,
    mode: 'local-demo'
  });
}

// Serve the website files.
function serveStatic(req, res) {
  let requestedPath;

  try {
    requestedPath = decodeURIComponent(
      new URL(req.url, `http://${HOST}`).pathname
    );
  } catch {
    return sendJson(res, 400, {
      error: 'Invalid URL.'
    });
  }

  if (requestedPath === '/') {
    requestedPath = '/index.html';
  }

  const resolved = path.resolve(
    PUBLIC_DIR,
    `.${requestedPath}`
  );

  if (!resolved.startsWith(PUBLIC_DIR + path.sep)) {
    return sendJson(res, 403, {
      error: 'Forbidden.'
    });
  }

  fs.readFile(resolved, (error, contents) => {
    if (error) {
      return sendJson(res, 404, {
        error: 'File not found. Check your public folder.'
      });
    }

    res.writeHead(200, {
      'Content-Type':
        MIME_TYPES[path.extname(resolved)] ||
        'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store'
    });

    res.end(contents);
  });
}

// Create the HTTP server.
const server = http.createServer(async (req, res) => {
  if (
    req.method === 'GET' &&
    req.url === '/api/status'
  ) {
    return sendJson(res, 200, {
      configured: false,
      model: null,
      mode: 'local-demo'
    });
  }

  if (
    req.method === 'POST' &&
    req.url === '/api/chat'
  ) {
    return handleChat(req, res);
  }

  if (req.method !== 'GET') {
    return sendJson(res, 405, {
      error: 'Method not allowed.'
    });
  }

  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('====================================');
  console.log('       NOVA CHATBOT STARTED');
  console.log('====================================');
  console.log(`Website: http://${HOST}:${PORT}`);
  console.log('Mode: FREE LOCAL DEMO');
  console.log('API key required: NO');
  console.log('====================================');
  console.log('');
});