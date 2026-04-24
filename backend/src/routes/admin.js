import { json } from '../index';

const ADMIN_PASS = 'admin@harjeet2024';

export async function handleAdmin(request, env, path) {

  if (path === '/api/admin/add-client' && request.method === 'POST') {
    const body = await request.json();
    if (body.adminPass !== ADMIN_PASS) return json({ error: 'Unauthorized' }, 401);
    const { businessName, businessEmail, widgetKey, description, plan, websiteUrl, botName, themeColor, logoUrl } = body;
    if (!businessName || !businessEmail || !widgetKey) return json({ error: 'Required fields missing' }, 400);
    const existing = await env.DB.prepare('SELECT id FROM clients WHERE business_email = ? OR widget_key = ?').bind(businessEmail, widgetKey).first();
    if (existing) return json({ error: 'Client with this email or key already exists' }, 409);
    await env.DB.prepare(`INSERT INTO clients (business_name, business_email, widget_key, description, plan, website_url, bot_name, theme_color, logo_url, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(businessName, businessEmail, widgetKey, description || '', plan || '1499', websiteUrl || '', botName || 'Assistant', themeColor || '#2563eb', logoUrl || '', new Date().toISOString()).run();
    return json({ success: true, widgetKey });
  }

  if (path === '/api/admin/clients' && request.method === 'POST') {
    const body = await request.json();
    if (body.adminPass !== ADMIN_PASS) return json({ error: 'Unauthorized' }, 401);
    const { results } = await env.DB.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    return json({ clients: results });
  }

  if (path === '/api/admin/toggle-client' && request.method === 'POST') {
    const body = await request.json();
    if (body.adminPass !== ADMIN_PASS) return json({ error: 'Unauthorized' }, 401);
    await env.DB.prepare('UPDATE clients SET active = ? WHERE widget_key = ?').bind(body.active, body.widgetKey).run();
    return json({ success: true });
  }

  if (path === '/api/admin/edit-client' && request.method === 'POST') {
    const body = await request.json();
    if (body.adminPass !== ADMIN_PASS) return json({ error: 'Unauthorized' }, 401);
    const { widgetKey, businessName, businessEmail, description, plan, websiteUrl, botName, themeColor, logoUrl } = body;
    if (!widgetKey) return json({ error: 'widgetKey required' }, 400);
    await env.DB.prepare(`UPDATE clients SET business_name=?, business_email=?, description=?, plan=?, website_url=?, bot_name=?, theme_color=?, logo_url=? WHERE widget_key=?`)
      .bind(businessName, businessEmail, description || '', plan || '1499', websiteUrl || '', botName || 'Assistant', themeColor || '#2563eb', logoUrl || '', widgetKey).run();
    return json({ success: true });
  }

  return json({ error: 'Not found' }, 404);
}