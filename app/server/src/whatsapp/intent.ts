/**
 * WhatsApp Intent Parser
 * Ported from stockwise-whatsapp — parses inbound messages into intents.
 */

export type IntentType = 'score' | 'explain' | 'help' | 'unknown';

export interface Intent {
  type: IntentType;
  ticker?: string;
  query?: string;
}

const COMMON_WORDS = new Set([
  'A', 'I', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY',
  'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE', 'ALL', 'AND', 'ARE', 'BUT', 'CAN', 'FOR',
  'HAD', 'HAS', 'HER', 'HIM', 'HIS', 'HOW', 'ITS', 'NEW', 'NOT', 'NOW', 'OFF', 'OLD', 'ONE', 'OUR',
  'OUT', 'SEE', 'SHE', 'THE', 'TWO', 'USE', 'WAY', 'WHO', 'YES', 'YET', 'YOU', 'WHY', 'HEY', 'HII',
  'THEY', 'THEM', 'THAN', 'THEN', 'THAT', 'THIS', 'WILL', 'WITH', 'HAVE', 'FROM', 'HELP', 'HII',
  'STOP', 'MENU', 'HOLA', 'INFO', 'SCORE', 'STOCK', 'PRICE', 'ABOUT', 'WORTH', 'SHOULD', 'BUY',
]);

const GREETINGS = new Set(['hi', 'hello', 'hey', 'start', 'help', 'menu', 'hola', 'yo', 'sup']);

/** Extract the first plausible ticker from free text. */
export function extractTicker(text: string): string | undefined {
  const dollar = text.match(/\$([A-Za-z]{1,5})\b/);
  if (dollar) return dollar[1].toUpperCase();

  const upper = text.match(/\b[A-Z]{1,5}\b/g);
  if (upper) {
    for (const tok of upper) {
      if (tok.length >= 1 && !COMMON_WORDS.has(tok)) return tok;
    }
  }
  return undefined;
}

export function parseIntent(raw: string): Intent {
  const text = (raw || '').trim();
  if (!text) return { type: 'help' };

  const lower = text.toLowerCase();
  const firstWord = lower.split(/\s+/)[0];

  if (GREETINGS.has(firstWord) && text.split(/\s+/).length === 1) {
    return { type: 'help' };
  }

  const wantsExplain = /\b(explain|why|reason|breakdown|tell me about)\b/.test(lower);
  const ticker = extractTicker(text);

  if (wantsExplain) {
    return ticker ? { type: 'explain', ticker } : { type: 'explain', query: stripKeywords(text) };
  }

  if (ticker || /\b(score|stock|price|quote|rate|worth)\b/.test(lower)) {
    return ticker ? { type: 'score', ticker } : { type: 'score', query: stripKeywords(text) };
  }

  if (text.length >= 2 && /[a-zA-Z]/.test(text)) {
    return { type: 'score', query: stripKeywords(text) };
  }

  return { type: 'unknown' };
}

function stripKeywords(text: string): string {
  return text
    .replace(/\b(explain|why|reason|breakdown|tell me about|score|stock|price|quote|rate|worth|the|of|for|me|about)\b/gi, ' ')
    .replace(/[?$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
