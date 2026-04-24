import { json, sessions } from '../index';

export async function handleChat(request, env) {
  const GROQ_API_KEY = env.GROQ_API_KEY;
  const BREVO_API_KEY = env.BREVO_API_KEY;
  const BREVO_SENDER_EMAIL = env.BREVO_SENDER_EMAIL;

  const body = await request.json();
  const { message, sessionId, widgetKey } = body;

  if (!message || !sessionId || !widgetKey) {
    return json({ error: 'message, sessionId and widgetKey are required' }, 400);
  }

  const client = await env.DB.prepare(
    'SELECT * FROM clients WHERE widget_key = ? AND active = 1'
  ).bind(widgetKey).first();

  if (!client) return json({ error: 'Invalid widget key' }, 403);

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], leadCaptured: false });
  }
  const session = sessions.get(sessionId);

  const knowledge = client.description
    ? `\n\nBUSINESS KNOWLEDGE BASE:\n${client.description}\n\nUse this to answer visitor questions. If something is not in the knowledge base, say the team will follow up.`
    : '';

  const systemPrompt = `You are a friendly AI assistant for ${client.business_name}.${knowledge}

CRITICAL LANGUAGE RULE:
- Detect the language the visitor is writing in
- ALWAYS reply in the SAME language the visitor used
- If they write in Hindi, reply in Hindi
- If they write in Tamil, reply in Tamil
- If they write in Arabic, reply in Arabic
- If they write in English, reply in English
- Match their language automatically in every single message

Follow these steps in order:
1. Greet the visitor and ask what they are looking for
2. Answer their questions using the knowledge base
3. Ask for their NAME (only after engaging with them)
4. Ask for their WHATSAPP NUMBER (only after you have their name)
5. Once you have BOTH name AND WhatsApp number confirmed, thank them

CRITICAL RULES:
- Never add LEAD_CAPTURED until visitor has given BOTH name AND WhatsApp number
- WhatsApp number must be at least 10 digits
- Keep messages SHORT — 1 to 2 sentences max
- Ask ONE question at a time
- Be warm and human

Once you have confirmed BOTH name AND WhatsApp number, add this on a new line at the END:
LEAD_CAPTURED:{"name":"THEIR_NAME","whatsapp":"THEIR_WHATSAPP","need":"WHAT_THEY_WANT"}

NEVER add LEAD_CAPTURED without both name and WhatsApp.
NEVER show LEAD_CAPTURED to the user.
Only add LEAD_CAPTURED once.`;

  session.messages.push({ role: 'user', content: message });

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...session.messages,
      ],
      max_tokens: 400,
      temperature: 0.5,
    }),
  });

  if (!groqRes.ok) {
    console.error('Groq error:', await groqRes.text());
    return json({ error: 'AI failed' }, 500);
  }

  const groqData = await groqRes.json();
  const rawReply = groqData.choices[0].message.content;

  const leadMatch = rawReply.match(/LEAD_CAPTURED:(\{[^}]+\})/);
  let leadCaptured = session.leadCaptured;

  if (leadMatch && !session.leadCaptured) {
    try {
      const leadData = JSON.parse(leadMatch[1]);
      if (leadData.name && leadData.whatsapp && leadData.whatsapp.replace(/\D/g,'').length >= 10) {
        session.leadCaptured = true;
        leadCaptured = true;
        await env.DB.prepare(
          'INSERT INTO leads (business_name, business_email, visitor_name, whatsapp, need, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          client.business_name, client.business_email,
          leadData.name, leadData.whatsapp, leadData.need,
          sessionId, new Date().toISOString()
        ).run();
        await sendEmail(BREVO_API_KEY, BREVO_SENDER_EMAIL, client, leadData);
      }
    } catch (e) {
      console.error('Lead error:', e);
    }
  }

  const cleanReply = rawReply.replace(/LEAD_CAPTURED:\{[^}]+\}/g, '').trim();
  session.messages.push({ role: 'assistant', content: cleanReply });

  return json({ reply: cleanReply, leadCaptured });
}

async function sendEmail(BREVO_API_KEY, BREVO_SENDER_EMAIL, client, leadData) {
  const wa = leadData.whatsapp.replace(/\D/g, '');
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'LeadBot', email: BREVO_SENDER_EMAIL },
      to: [{ email: client.business_email, name: client.business_name }],
      subject: `🔥 New Lead: ${leadData.name} — ${client.business_name}`,
      htmlContent: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="background:#2563eb;padding:20px;border-radius:8px;margin-bottom:24px;">
            <h2 style="color:white;margin:0;">🔥 New Lead Captured!</h2>
            <p style="color:#bfdbfe;margin:4px 0 0;">${client.business_name}</p>
          </div>
          <p style="margin-bottom:8px;"><strong>Name:</strong> ${leadData.name}</p>
          <p style="margin-bottom:8px;"><strong>WhatsApp:</strong> ${leadData.whatsapp}</p>
          <p style="margin-bottom:8px;"><strong>Looking for:</strong> ${leadData.need}</p>
          <p style="margin-bottom:24px;"><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
          <a href="https://wa.me/91${wa}" style="display:inline-block;padding:14px 28px;background:#25D366;color:white;text-decoration:none;border-radius:8px;font-weight:700;">💬 Reply on WhatsApp</a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Powered by LeadBot 🚀</p>
        </div>
      `,
    }),
  });
}