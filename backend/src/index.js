import { handleChat } from './routes/chat';
import { handleLeads } from './routes/leads';
import { handleWidget } from './routes/widget';
import { handleAdmin } from './routes/admin';

export const sessions = new Map();

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response;

      if (path === '/api/chat' && request.method === 'POST') {
        response = await handleChat(request, env);
      } else if (path === '/api/leads' && request.method === 'GET') {
        response = await handleLeads(request, env);
      } else if (path === '/api/widget.js' && request.method === 'GET') {
        response = await handleWidget(request, env);
      } else if (path.startsWith('/api/admin')) {
        response = await handleAdmin(request, env, path);
      } else if (path === '/') {
        response = json({ status: 'LeadBot API running ✅', version: '1.0.0' });
      } else {
        response = json({ error: 'Not found' }, 404);
      }

      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(response.body, { status: response.status, headers: newHeaders });

    } catch (err) {
      console.error(err);
      return json({ error: 'Server error' }, 500);
    }
  }
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}