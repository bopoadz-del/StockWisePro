/**
 * WhatsApp Text Formatting
 * Ported from stockwise-whatsapp — formats scores for WhatsApp (Markdown-like).
 */

import { OpenBoxScore } from '../services/scoring';

function signalLabel(signal: string): string {
  const s = (signal || '').toLowerCase();
  if (s.includes('strong buy')) return 'STRONG BUY';
  if (s.includes('buy')) return 'BUY';
  if (s.includes('sell')) return 'SELL';
  if (s.includes('hold')) return 'HOLD';
  return signal ? signal.toUpperCase() : 'N/A';
}

function scoreToSignal(score: number): string {
  if (score >= 85) return 'strong buy';
  if (score >= 70) return 'buy';
  if (score >= 55) return 'hold';
  if (score >= 40) return 'watch';
  return 'avoid';
}

function gradeFromScore(score: number): string {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

interface QuoteInfo {
  price?: number;
  name?: string;
  changesPercentage?: number;
}

function priceLine(q: QuoteInfo | null): string {
  if (!q || typeof q.price !== 'number' || q.price <= 0) return '';
  const pct = typeof q.changesPercentage === 'number'
    ? ` (${q.changesPercentage >= 0 ? '+' : ''}${q.changesPercentage.toFixed(2)}%)`
    : '';
  return `\nPrice: $${q.price.toFixed(2)}${pct}`;
}

export function formatScore(score: OpenBoxScore, quote?: QuoteInfo | null): string {
  const pillars = score.pillars
    ? '\n' + Object.entries(score.pillars)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n')
    : '';

  const riskLine = score.riskFlags && score.riskFlags.length > 0
    ? `\nRisk flags: ${score.riskFlags.join(', ')}`
    : '';

  return (
    `*${score.ticker}*${quote?.name ? ` — ${quote.name}` : ''}\n` +
    `Score: *${score.finalScore}/100* (Grade: ${gradeFromScore(score.finalScore)})\n` +
    `Signal: ${signalLabel(scoreToSignal(score.finalScore))}` +
    priceLine(quote || null) +
    (score.sector ? `\nSector: ${score.sector}${score.industry ? ` / ${score.industry}` : ''}` : '') +
    pillars +
    riskLine +
    `\n\n_Reply "explain ${score.ticker}" for the why._\n` +
    `_Experimental study — not financial advice._`
  );
}

export function deterministicExplain(score: OpenBoxScore): string {
  const entries = Object.entries(score.pillars || {});
  let extra = '';
  if (entries.length) {
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    extra = ` Its strongest area is ${top[0]} (${top[1]}) and its weakest is ${bottom[0]} (${bottom[1]}).`;
  }
  const sector = score.sector ? ` It operates in ${score.sector}.` : '';
  return `${score.ticker} scored ${score.finalScore}/100, a ${signalLabel(scoreToSignal(score.finalScore))} signal.${extra}${sector}`;
}

export function formatExplain(score: OpenBoxScore, narrative: string): string {
  return (
    `*${score.ticker}* — why ${score.finalScore}/100 (${signalLabel(scoreToSignal(score.finalScore))})\n\n` +
    `${narrative}\n\n` +
    `_Experimental study — not financial advice._`
  );
}

export const HELP_TEXT =
  '*StockWise on WhatsApp* 📈\n\n' +
  'Send me a ticker or company and I will score it:\n' +
  '• `AAPL` or `score TSLA`\n' +
  '• `explain NVDA` — the reasoning behind the score\n' +
  '• `apple` — I will find the ticker\n\n' +
  '_Experimental study — not financial advice._';

export function notFound(what: string): string {
  return `Could not find a stock for "${what}". Try a ticker like AAPL, or a company name.`;
}

export function tempError(symbol: string): string {
  return `Could not fetch ${symbol} right now — please try again in a moment.`;
}
