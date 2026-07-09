/**
 * Ollama Cloud LLM Client
 * Ported from stockwise-whatsapp — generates grounded score explanations.
 * Uses the same Ollama Cloud setup as the Telegram bot's /explain command.
 */

import axios from 'axios';
import { OpenBoxScore } from '../services/scoring';

interface ChatResponse {
  message?: { content?: string };
}

const SYSTEM =
  'You are an equity-analysis assistant. Given recorded scoring data for a stock, ' +
  'explain in 3-4 short sentences what the data suggests about the score, the strong/weak ' +
  'pillars, and the signal. Use ONLY the data provided; do not invent prices or numbers. ' +
  'This is an experimental study, not financial advice. Keep it under 90 words, plain text.';

export function isLlmEnabled(): boolean {
  return Boolean(process.env.OLLAMA_API_KEY);
}

/** Generate a grounded narrative for a score. Returns null on any failure. */
export async function explainScore(score: OpenBoxScore): Promise<string | null> {
  const apiKey = process.env.OLLAMA_API_KEY;
  const ollamaUrl = (process.env.OLLAMA_URL || 'https://ollama.com').replace(/\/+$/, '');
  const model = process.env.OLLAMA_MODEL || 'kimi-k2.6';

  if (!apiKey) return null;

  const pillars = score.pillars
    ? Object.entries(score.pillars).map(([k, v]) => `${k}=${v}`).join(', ')
    : 'n/a';

  const context =
    `Ticker: ${score.ticker}\n` +
    `Sector: ${score.sector || 'n/a'} / ${score.industry || 'n/a'}\n` +
    `Score: ${score.finalScore}/100\n` +
    `Pillars: ${pillars}\n` +
    `Risk flags: ${(score.riskFlags || []).join(', ') || 'none'}\n` +
    `Narrative: ${score.narrative}`;

  try {
    const { data } = await axios.post<ChatResponse>(
      `${ollamaUrl}/api/chat`,
      {
        model,
        stream: false,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Explain this score:\n${context}` },
        ],
      },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 12000,
      }
    );
    return data?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
