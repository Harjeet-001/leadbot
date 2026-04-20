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
    ? `\n\nBUSINESS KNOWLEDGE BASE:\n${client.description}\n\nUse this information to answer any questions visitors have about the business. If asked something not in the knowledge base, say you'll have the team follow up.`
    : '';

  const systemPrompt = `You are a friendly AI assistant for ${client.business_name}.${knowledge}

Your goals in order:
1. Greet the visitor warmly and ask what they are looking for
2. Answer any questions they have about the business using the knowledge base above
3. Once they seem interested, naturally ask for their name
4. Ask for their WhatsApp number so the team can follow up
5. Thank them and say the team will reach out within a few hours

Rules:
- Keep every message SHORT — 1 to 2 sentences max
- Ask ONE question at a time only
- Be warm and human, never robotic
- Answer questions confidently using the knowledge base
- Once you have BOTH their name AND WhatsApp number, add this at the very end of your message on a new line:
  LEAD_CAPTURED:{"name":"THEIR_NAME","whatsapp":"THEIR_NUMBER","need":"WHAT_THEY_WANT"}
- Never show the LEAD_CAPTURED tag to the user
- Only add LEAD_CAPTURED once`;

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
      temperature: 0.7,
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
    session.leadCaptured = true;
    leadCaptured = true;
    try {
      const leadData = JSON.parse(leadMatch[1]);
      await env.DB.prepare(
        'INSERT INTO leads (business_name, business_email, visitor_name, whatsapp, need, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        client.business_name, client.business_email,
        leadData.name, leadData.whatsapp, leadData.need,
        sessionId, new Date().toISOString()
      ).run();
      await sendEmail(BREVO_API_KEY, BREVO_SENDER_EMAIL, client, leadData);
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
          <p><strong>Name:</strong> ${leadData.name}</p>
          <p><strong>WhatsApp:</strong> ${leadData.whatsapp}</p>
          <p><strong>Looking for:</strong> ${leadData.need}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString('en-IN')}</p>
          <a href="https://wa.me/91${wa}" style="display:inline-block;margin-top:16px;padding:14px 28px;background:#25D366;color:white;text-decoration:none;border-radius:8px;font-weight:700;">💬 Reply on WhatsApp</a>
          <p style="margin-top:24px;color:#9ca3af;font-size:12px;">Powered by LeadBot 🚀</p>
        </div>
      `,
    }),
  });
}