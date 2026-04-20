import { json } from '../index';

const DASHBOARD_SECRET = 'leadbot2024';

export async function handleLeads(request, env) {
  const url = new URL(request.url);
  const widgetKey = url.searchParams.get('widgetKey');
  const secret = url.searchParams.get('secret');

  if (!widgetKey || !secret) {
    return json({ error: 'widgetKey and secret required' }, 401);
  }

  if (secret !== DASHBOARD_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const client = await env.DB.prepare(
    'SELECT * FROM clients WHERE widget_key = ? AND active = 1'
  ).bind(widgetKey).first();

  if (!client) {
    return json({ error: 'Client not found' }, 404);
  }

  const { results } = await env.DB.prepare(
    'SELECT * FROM leads WHERE business_email = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(client.business_email).all();

  return json({
    business: client.business_name,
    total: results.length,
    leads: results,
  });
}