export async function handleWidget(request, env) {
  const url = new URL(request.url);
  const widgetKey = url.searchParams.get('key');

  if (!widgetKey) {
    return new Response('// Error: Missing widget key', { headers: { 'Content-Type': 'application/javascript' } });
  }

  const client = await env.DB.prepare('SELECT * FROM clients WHERE widget_key = ? AND active = 1').bind(widgetKey).first();
  if (!client) {
    return new Response('// Error: Invalid widget key', { headers: { 'Content-Type': 'application/javascript' } });
  }

  const backendUrl = 'https://leadbot-backend.harjeetgowda644.workers.dev';
  const botName = client.bot_name || 'Assistant';
  const themeColor = client.theme_color || '#2563eb';
  const logoUrl = client.logo_url || '';

  // Darken theme color for hover
  const script = `
(function() {
  const WIDGET_KEY = '${widgetKey}';
  const BACKEND = '${backendUrl}';
  const SESSION_ID = Math.random().toString(36).slice(2) + Date.now();
  const BOT_NAME = '${botName}';
  const THEME = '${themeColor}';
  const LOGO = '${logoUrl}';

  const style = document.createElement('style');
  style.textContent = \`
    #lb-bubble {
      position:fixed;bottom:24px;right:24px;width:60px;height:60px;
      border-radius:50%;background:\${THEME};cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 24px rgba(0,0,0,0.25);
      transition:transform 0.2s;z-index:99999;border:none;
    }
    #lb-bubble:hover{transform:scale(1.08);}
    #lb-bubble img{width:38px;height:38px;border-radius:50%;object-fit:cover;}
    #lb-bubble svg{width:28px;height:28px;fill:white;}
    #lb-dot{position:absolute;top:2px;right:2px;width:13px;height:13px;
      background:#22c55e;border-radius:50%;border:2px solid white;}
    #lb-win{
      position:fixed;bottom:96px;right:24px;width:350px;height:500px;
      background:white;border-radius:20px;
      box-shadow:0 12px 48px rgba(0,0,0,0.18);
      display:none;flex-direction:column;overflow:hidden;
      z-index:99998;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    }
    @media(max-width:480px){
      #lb-win{
        position:fixed;bottom:0;right:0;left:0;top:0;
        width:100%;height:100%;border-radius:0;
      }
      #lb-bubble{bottom:16px;right:16px;}
    }
    #lb-win.open{display:flex;}
    #lb-head{padding:16px 20px;color:white;display:flex;align-items:center;gap:12px;background:\${THEME};}
    #lb-head-logo{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.4);}
    #lb-head-icon{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);
      display:flex;align-items:center;justify-content:center;}
    #lb-head-icon svg{width:18px;height:18px;fill:white;}
    #lb-head-info{flex:1;}
    #lb-head-info h3{margin:0;font-size:15px;font-weight:600;}
    #lb-head-info p{margin:2px 0 0;font-size:12px;opacity:0.85;}
    #lb-close{background:rgba(255,255,255,0.2);border:none;color:white;
      width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    #lb-close:hover{background:rgba(255,255,255,0.3);}
    #lb-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
    .lb-m{max-width:82%;padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.5;animation:lbIn 0.2s ease;}
    .lb-bot{background:#f3f4f6;color:#111;align-self:flex-start;border-bottom-left-radius:4px;}
    .lb-user{color:white;align-self:flex-end;border-bottom-right-radius:4px;background:\${THEME};}
    .lb-typing{background:#f3f4f6;padding:12px 16px;border-radius:14px;border-bottom-left-radius:4px;align-self:flex-start;}
    .lb-typing span{display:inline-block;width:7px;height:7px;background:#9ca3af;border-radius:50%;margin:0 2px;animation:lbBounce 1.2s infinite;}
    .lb-typing span:nth-child(2){animation-delay:0.2s;}
    .lb-typing span:nth-child(3){animation-delay:0.4s;}
    @keyframes lbBounce{0%,60%,100%{transform:translateY(0);}30%{transform:translateY(-6px);}}
    @keyframes lbIn{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}
    #lb-bar{padding:12px 16px;border-top:1px solid #f3f4f6;display:flex;gap:8px;align-items:center;}
    #lb-inp{flex:1;border:1.5px solid #e5e7eb;border-radius:24px;padding:10px 16px;
      font-size:14px;outline:none;transition:border-color 0.2s;font-family:inherit;}
    #lb-inp:focus{border-color:\${THEME};}
    #lb-send{width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;background:\${THEME};}
    #lb-send:hover{opacity:0.85;}
    #lb-send svg{width:16px;height:16px;fill:white;}
    #lb-powered{text-align:center;font-size:11px;color:#9ca3af;padding:6px 0 10px;}
  \`;
  document.head.appendChild(style);

  // Build bubble
  const bubble = document.createElement('button');
  bubble.id = 'lb-bubble';
  bubble.setAttribute('aria-label', 'Open chat');
  if (LOGO) {
    bubble.innerHTML = \`<img src="\${LOGO}" alt="logo" onerror="this.parentNode.innerHTML='<svg viewBox=\\"0 0 24 24\\"><path d=\\"M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z\\"/></svg>'"/><div id="lb-dot"></div>\`;
  } else {
    bubble.innerHTML = \`<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg><div id="lb-dot"></div>\`;
  }

  // Build window
  const win = document.createElement('div');
  win.id = 'lb-win';
  const headerLogo = LOGO
    ? \`<img id="lb-head-logo" src="\${LOGO}" alt="logo" onerror="this.style.display='none'"/>\`
    : \`<div id="lb-head-icon"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></div>\`;

  win.innerHTML = \`
    <div id="lb-head">
      \${headerLogo}
      <div id="lb-head-info">
        <h3>\${BOT_NAME}</h3>
        <p>🟢 Online — reply in minutes</p>
      </div>
      <button id="lb-close" aria-label="Close chat">×</button>
    </div>
    <div id="lb-msgs"></div>
    <div id="lb-bar">
      <input id="lb-inp" type="text" placeholder="Type a message..." autocomplete="off"/>
      <button id="lb-send" aria-label="Send">
        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
      </button>
    </div>
    <div id="lb-powered">Powered by LeadBot</div>
  \`;

  document.body.appendChild(bubble);
  document.body.appendChild(win);

  const msgs = document.getElementById('lb-msgs');
  const inp = document.getElementById('lb-inp');
  let open = false, waiting = false;

  function addMsg(text, role) {
    const d = document.createElement('div');
    d.className = 'lb-m lb-' + role;
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    const d = document.createElement('div');
    d.className = 'lb-typing'; d.id = 'lb-t';
    d.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }

  function hideTyping() { const t = document.getElementById('lb-t'); if(t) t.remove(); }

  async function send(text) {
    if (!text.trim() || waiting) return;
    waiting = true; inp.value = '';
    addMsg(text, 'user'); showTyping();
    try {
      const r = await fetch(BACKEND + '/api/chat', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ message: text, sessionId: SESSION_ID, widgetKey: WIDGET_KEY }),
      });
      const d = await r.json();
      hideTyping();
      addMsg(d.reply || 'Something went wrong.', 'bot');
    } catch(e) {
      hideTyping();
      addMsg('Connection error. Please try again.', 'bot');
    }
    waiting = false;
  }

  function toggleChat() {
    open = !open;
    win.classList.toggle('open', open);
    if (open && msgs.children.length === 0) {
      setTimeout(() => {
        showTyping();
        setTimeout(() => {
          hideTyping();
          addMsg('Hey! 👋 Welcome. What can I help you with today?', 'bot');
          inp.focus();
        }, 900);
      }, 300);
    }
    if (open) inp.focus();
  }

  bubble.addEventListener('click', toggleChat);
  document.getElementById('lb-close').addEventListener('click', toggleChat);
  document.getElementById('lb-send').addEventListener('click', () => send(inp.value));
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') send(inp.value); });
})();
  `;

  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  });
}