/**
 * WhatsApp Module
 * Exports the Twilio webhook route and message handler.
 * 
 * Usage: import whatsappRouter from './whatsapp';
 *        app.use('/whatsapp', whatsappRouter);
 */

import { Router } from 'express';
import { handleMessage } from './handler';

const router = Router();

// Twilio "When a message comes in" webhook
router.post('/', async (req, res) => {
  const body: string = (req.body && (req.body.Body || req.body.body)) || '';
  const from: string = (req.body && req.body.From) || 'unknown';

  let reply: string;
  try {
    const result = await handleMessage(body);
    reply = result.text;
  } catch (err) {
    console.error(`[whatsapp] handler error from ${from}:`, (err as Error).message);
    reply = 'Something went wrong on our side — please try again in a moment.';
  }

  // Twilio expects TwiML XML response
  res.set('Content-Type', 'text/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<Response><Message>${escapeXml(reply)}</Message></Response>`
  );
});

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default router;
export { handleMessage } from './handler';
export { parseIntent, extractTicker } from './intent';
export { formatScore, formatExplain, deterministicExplain, HELP_TEXT } from './format';
export { explainScore, isLlmEnabled } from './ollama';
