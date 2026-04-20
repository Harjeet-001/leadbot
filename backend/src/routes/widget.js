export async function handleWidget(request, env) {
  const url = new URL(request.url);
  const widgetKey = url.searchParams.get('key');

  if (!widgetKey) {
    return new Response('// Error: Missing widget key', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }

  // The widget script that gets injected into client websites
  // BACKEND_URL gets replaced at deploy time
  const backendUrl = 'https://leadbot-backend.harjeetgowda644.workers.dev';
  const widgetScript = `
(function() {
  const WIDGET_KEY = '${widgetKey}';
  const BACKEND_URL = '${backendUrl}';
  const SESSION_ID = Math.random().toString(36).substring(2) + Date.now();

  // Styles
  const style = document.createElement('style');
  style.textContent = \`
    #leadbot-bubble {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: #2563eb; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(37,99,235,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      z-index: 99999;
    }
    #leadbot-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(37,99,235,0.5); }
    #leadbot-bubble svg { width: 26px; height: 26px; fill: white; }
    #leadbot-window {
      position: fixed; bottom: 92px; right: 24px;
      width: 340px; height: 480px;
      background: white; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.15);
      display: none; flex-direction: column;
      overflow: hidden; z-index: 99998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #leadbot-window.open { display: flex; }
    #leadbot-header {
      background: #2563eb; padding: 16px 20px;
      color: white;
    }
    #leadbot-header h3 { margin: 0; font-size: 15px; font-weight: 600; }
    #leadbot-header p { margin: 2px 0 0 0; font-size: 12px; opacity: 0.8; }
    #leadbot-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .lb-msg {
      max-width: 80%; padding: 10px 14px;
      border-radius: 14px; font-size: 14px; line-height: 1.4;
      animation: lbFadeIn 0.2s ease;
    }
    .lb-bot { background: #f3f4f6; color: #111827; align-self: flex-start; border-bottom-left-radius: 4px; }
    .lb-user { background: #2563eb; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
    .lb-typing { background: #f3f4f6; padding: 12px 16px; border-radius: 14px; border-bottom-left-radius: 4px; align-self: flex-start; }
    .lb-typing span { display: inline-block; width: 7px; height: 7px; background: #9ca3af; border-radius: 50%; margin: 0 2px; animation: lbBounce 1.2s infinite; }
    .lb-typing span:nth-child(2) { animation-delay: 0.2s; }
    .lb-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lbBounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
    @keyframes lbFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    #leadbot-input-area {
      padding: 12px 16px; border-top: 1px solid #f3f4f6;
      display: flex; gap: 8px;
    }
    #leadbot-input {
      flex: 1; border: 1px solid #e5e7eb; border-radius: 24px;
      padding: 10px 16px; font-size: 14px; outline: none;
      transition: border-color 0.2s;
    }
    #leadbot-input:focus { border-color: #2563eb; }
    #leadbot-send {
      width: 38px; height: 38px; border-radius: 50%;
      background: #2563eb; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
    }
    #leadbot-send:hover { background: #1d4ed8; }
    #leadbot-send svg { width: 16px; height: 16px; fill: white; }
    #leadbot-dot {
      position: absolute; top: 0; right: 0;
      width: 14px; height: 14px; background: #22c55e;
      border-radius: 50%; border: 2px solid white;
    }
  \`;
  document.head.appendChild(style);

  // HTML
  const bubble = document.createElement('div');
  bubble.id = 'leadbot-bubble';
  bubble.innerHTML = \`
    <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    <div id="leadbot-dot"></div>
  \`;

  const win = document.createElement('div');
  win.id = 'leadbot-window';
  win.innerHTML = \`
    <div id="leadbot-header">
      <h3>👋 Hi there!</h3>
      <p>Ask us anything — we reply fast</p>
    </div>
    <div id="leadbot-messages"></div>
    <div id="leadbot-input-area">
      <input id="leadbot-input" type="text" placeholder="Type a message..." autocomplete="off" />
      <button id="leadbot-send">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
  \`;

  document.body.appendChild(bubble);
  document.body.appendChild(win);

  const messagesEl = document.getElementById('leadbot-messages');
  const inputEl = document.getElementById('leadbot-input');
  let isOpen = false;
  let isWaiting = false;

  function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = 'lb-msg lb-' + role;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'lb-typing';
    div.id = 'lb-typing-indicator';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping() {
    const t = document.getElementById('lb-typing-indicator');
    if (t) t.remove();
  }

  async function sendMessage(text) {
    if (!text.trim() || isWaiting) return;
    isWaiting = true;
    inputEl.value = '';
    addMessage(text, 'user');
    showTyping();

    try {
      const res = await fetch(BACKEND_URL + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: SESSION_ID, widgetKey: WIDGET_KEY }),
      });
      const data = await res.json();
      hideTyping();
      addMessage(data.reply || 'Sorry, something went wrong.', 'bot');
    } catch (e) {
      hideTyping();
      addMessage('Connection error. Please try again.', 'bot');
    }
    isWaiting = false;
  }

  // Toggle chat window
  bubble.addEventListener('click', () => {
    isOpen = !isOpen;
    win.classList.toggle('open', isOpen);
    if (isOpen && messagesEl.children.length === 0) {
      setTimeout(() => {
        showTyping();
        setTimeout(() => {
          hideTyping();
          addMessage('Hey! 👋 Welcome. What can I help you with today?', 'bot');
        }, 800);
      }, 300);
    }
  });

  // Send on button click
  document.getElementById('leadbot-send').addEventListener('click', () => {
    sendMessage(inputEl.value);
  });

  // Send on Enter key
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(inputEl.value);
  });
})();
  `;

  return new Response(widgetScript, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}