import { getStore } from '@netlify/blobs';
import { gameHandler } from '../../lib/game.js';

// Standard function URL: /.netlify/functions/game. Netlify supplies Blobs access.
export default async function handler(request: Request): Promise<Response> {
  try {
    const store = getStore({ name: 'frontline-rooms', consistency: 'strong' });
    return await gameHandler(store)(request);
  } catch {
    return Response.json({ error: 'Multiplayer storage is unavailable. Deploy this project with Netlify Functions enabled.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
