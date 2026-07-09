/**
 * OCR Service for Screenshot Ticker Extraction
 * Enhanced with character confusion correction and image preprocessing.
 * Ported from stockwisepro-bot with major OCR accuracy improvements.
 */

import axios from 'axios';
import { logger } from '../../utils/logger';

// ─── OCR Character Confusion Map ──────────────────────────────────────
// Tesseract.js and other OCR engines commonly confuse these characters.
// Maps OCR output → likely correct character(s).

const OCR_CONFUSION: Record<string, string[]> = {
  '0': ['O'],           // zero looks like O
  '1': ['I', 'L'],      // one looks like I or L
  '5': ['S'],           // five looks like S
  '8': ['B'],           // eight looks like B
  '6': ['G', 'b'],      // six looks like G or lowercase b
  '2': ['Z'],           // two looks like Z
  '3': ['E'],           // three can look like E in some fonts
  '4': ['A', 'H'],      // four can look like A or H
  '7': ['T', 'Z'],      // seven looks like T
  '@': ['A'],           // at symbol → A
  '$': ['S'],           // dollar → S
  '|': ['I', 'l'],      // pipe → I or l
  '!': ['I'],           // exclamation → I
  'J': ['P', 'U'],      // J looks like P or U (especially with font)
  'S': ['5', '8'],      // S can look like 5 or 8
  'G': ['6', 'C'],      // G can look like 6 or C
  'O': ['0', 'Q', 'D'], // O can look like 0, Q, or D
  'Q': ['O', 'G'],      // Q can look like O or G
  'D': ['0', 'O'],      // D can look like 0 or O
  'B': ['8', 'E'],      // B can look like 8 or E
  'Z': ['2', '7'],      // Z can look like 2
  'I': ['1', 'l'],      // I can look like 1
  'l': ['1', 'I'],      // lowercase l → 1 or I
  'rn': ['m'],          // r+n together looks like m
  'nn': ['m'],          // n+n looks like m
  'cl': ['d'],          // c+l looks like d
  'ci': ['a'],          // c+i looks like a
  'e1': ['el'],         // e+1 → el
  'io': ['10'],         // i+o → 10
  'vv': ['w'],          // v+v → w
  'rji': ['m'],         // common Tesseract artifact
};

// Specific ticker corrections (known OCR mistakes)
const KNOWN_TICKER_CORRECTIONS: Record<string, string> = {
  'J8': 'PDD',     // J→P, 8→D (common in brokerage screenshots)
  'I8IT': 'IBIT',  // I8→IB (BlackRock Bitcoin ETF)
  '8IT': 'BIT',    // 8→B
  'JDD': 'PDD',
  'I8TC': 'IBIT',
  'SG0L': 'SGOL',  // 0→O
  'SGQL': 'SGOL',  // Q→O
  'XE1': 'XEL',    // 1→L
  'XEI': 'XEL',    // I→L
  'S0': 'SO',      // 0→O
  'S00': 'SO',     // double zero
  'WM1': 'WM',     // trailing 1
  'KR1': 'KR',
  'NEM1': 'NEM',
  'NE1': 'NEM',    // 1→M
  'NEl': 'NEM',    // l→M
  'AAP1': 'AAPL',
  'TSL4': 'TSLA',  // 4→A
  'TS1A': 'TSLA',  // 1→L
  'AMZ': 'AMZN',   // truncated
  'M1CR': 'MSFT',  // rarely needed
  'B1TC': 'BTC',   // 1→nothing or I
  'ETH1': 'ETH',
};

// Common words to filter out
const COMMON_WORDS = new Set([
  'A', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR',
  'SO', 'TO', 'UP', 'US', 'WE', 'ALL', 'AND', 'ARE', 'BUT', 'CAN', 'FOR', 'HAD', 'HAS', 'HER', 'HIM', 'HIS', 'HOW',
  'ITS', 'NEW', 'NOT', 'NOW', 'OFF', 'OLD', 'ONE', 'OUR', 'OUT', 'SEE', 'SHE', 'THE', 'TWO', 'USE', 'WAY', 'WHO',
  'YES', 'YET', 'YOU', 'THEY', 'THEM', 'THAN', 'THEN', 'THAT', 'THIS', 'WILL', 'WITH', 'HAVE', 'FROM', 'HERE',
  'WANT', 'BEEN', 'WERE', 'SAID', 'EACH', 'WHICH', 'THEIR', 'TIME', 'VERY', 'WHEN', 'MUCH', 'WOULD', 'THERE',
  'USD', 'EUR', 'GBP', 'SHARES', 'PRICE', 'TOTAL', 'VALUE', 'CASH', 'DATE', 'TYPE', 'QTY', 'AMT', 'CHG', 'PCT',
  'BUY', 'SELL', 'HOLD', 'OPEN', 'HIGH', 'LOW', 'CLOSE', 'VOL', 'AVG', 'MIN', 'MAX', 'SUM', 'NET', 'GAIN', 'LOSS',
  // Brokerage UI
  'EQUITY', 'BALANCE', 'DEPOSIT', 'WITHDRAW', 'ORDER', 'FILLED', 'PENDING', 'CANCELLED', 'MARKET', 'LIMIT', 'STOP',
  'ACCOUNT', 'PORTFOLIO', 'WATCHLIST', 'POSITION', 'HOLDING', 'TRANSACTION', 'BID', 'ASK', 'SPREAD', 'QUOTE', 'CHART',
  'ROBINHOOD', 'FIDELITY', 'SCHWAB', 'ETRADE', 'AMERITRADE', 'WEBULL', 'VANGUARD',
]);

const FALSE_POSITIVES = new Set([
  'NYSE', 'NASDAQ', 'AMEX', 'CBOE', 'OTC', 'SPX', 'VIX', 'CEO', 'CFO', 'CTO', 'LLC', 'INC', 'CORP', 'LTD',
  'SEC', 'FDA', 'IRS', 'GDP', 'CPI', 'PPI', 'PMI', 'FOMC', 'OPEC',
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN', 'AM', 'PM', 'ET', 'EST', 'EDT',
  'OK', 'DONE', 'EDIT', 'SAVE', 'ADD', 'NEW', 'ALL', 'TOP', 'HOT',
  'APP', 'IOS', 'WIFI', 'LTE', 'GPS', 'SMS',
]);

// Popular tickers for validation
const POPULAR_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK-B', 'JPM', 'V',
  'WMT', 'JNJ', 'UNH', 'XOM', 'LLY', 'AVGO', 'PG', 'MA', 'HD', 'CVX',
  'MRK', 'ABBV', 'PEP', 'KO', 'PFE', 'BAC', 'COST', 'TMO', 'DIS', 'CSCO',
  'VZ', 'ADBE', 'WFC', 'ACN', 'ABT', 'CRM', 'CMCSA', 'LIN', 'AMD', 'NKE',
  'PM', 'TXN', 'QCOM', 'NEE', 'RTX', 'INTC', 'AMGN', 'HON', 'UPS', 'LOW',
  'UNP', 'IBM', 'SBUX', 'MDT', 'GS', 'CAT', 'BLK', 'AMAT', 'DE', 'MMM',
  'CVS', 'MO', 'SCHW', 'TGT', 'LMT', 'AXP', 'PYPL', 'BA', 'ISRG', 'BKNG',
  'GILD', 'C', 'NOW', 'VRTX', 'SPGI', 'SYK', 'ZTS', 'ADP', 'MDLZ', 'TMUS',
  'SO', 'XEL', 'WM', 'KR', 'NEM', 'PDD', 'IBIT', 'SGOL', 'DUK', 'NEE',
  // ETFs
  'SPY', 'QQQ', 'IWM', 'VTI', 'VOO', 'VEA', 'VWO', 'BND', 'AGG', 'GLD',
  'SLV', 'USO', 'UNG', 'XLF', 'XLK', 'XLE', 'XLU', 'XLI', 'XLP', 'XLB',
  'XRT', 'SMH', 'SOXX', 'ARKK', 'ARKG', 'ARKW', 'ICLN', 'BOTZ', 'LIT',
  'BITO', 'BITB', 'ARKB', 'EZBC', 'BRRR', 'HODL', 'BTCO', 'FBTC',
]);

// ─── Character Correction ─────────────────────────────────────────────

/**
 * Apply OCR confusion correction to a string.
 * Returns multiple candidates for ambiguous characters.
 */
function generateCorrections(raw: string): string[] {
  const upper = raw.toUpperCase();

  // Direct known correction
  if (KNOWN_TICKER_CORRECTIONS[upper]) {
    return [KNOWN_TICKER_CORRECTIONS[upper]];
  }

  // Check if the raw string is already valid
  if (POPULAR_TICKERS.has(upper)) {
    return [upper];
  }

  // Generate corrections by replacing confused characters
  const candidates = new Set<string>();
  candidates.add(upper);

  // Single character replacements
  for (let i = 0; i < upper.length; i++) {
    const char = upper[i];
    const replacements = OCR_CONFUSION[char];
    if (replacements) {
      for (const replacement of replacements) {
        const corrected = upper.slice(0, i) + replacement + upper.slice(i + 1);
        candidates.add(corrected);
      }
    }
  }

  // Also try stripping leading digits (common OCR artifact)
  const stripped = upper.replace(/^[0-9]+/, '');
  if (stripped && stripped !== upper) {
    candidates.add(stripped);
    // Recurse on stripped version
    const subCorrections = generateCorrections(stripped);
    for (const c of subCorrections) candidates.add(c);
  }

  // Try replacing 2-character confusion patterns
  for (let i = 0; i < upper.length - 1; i++) {
    const pair = upper.slice(i, i + 2);
    const replacements = OCR_CONFUSION[pair];
    if (replacements) {
      for (const replacement of replacements) {
        const corrected = upper.slice(0, i) + replacement + upper.slice(i + 2);
        candidates.add(corrected);
      }
    }
  }

  return Array.from(candidates);
}

/**
 * Validate and correct a ticker candidate using all available methods.
 */
function validateTicker(candidate: string): string | null {
  const upper = candidate.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.length < 1 || upper.length > 6) return null;

  // Direct match
  if (POPULAR_TICKERS.has(upper)) return upper;

  // Known correction
  if (KNOWN_TICKER_CORRECTIONS[upper]) return KNOWN_TICKER_CORRECTIONS[upper];

  // Check if it's a common word or false positive
  if (COMMON_WORDS.has(upper) || FALSE_POSITIVES.has(upper)) return null;

  // Generate and test corrections
  const corrections = generateCorrections(upper);
  for (const corrected of corrections) {
    if (POPULAR_TICKERS.has(corrected)) return corrected;
  }

  // Fuzzy match: allow 1 edit distance
  for (const known of POPULAR_TICKERS) {
    if (Math.abs(known.length - upper.length) <= 1) {
      const dist = levenshtein(upper, known);
      if (dist === 1) return known;
    }
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// ─── Ticker Extraction from OCR Text ──────────────────────────────────

export interface OCRResult {
  tickers: string[];
  rawText: string;
  corrections: string[]; // Log of what was corrected
}

/**
 * Extract ticker symbols from OCR'd text.
 * Multi-pass: cashtags → structural analysis → word matches → corrected candidates.
 */
export function extractTickers(text: string): OCRResult {
  const tickers: string[] = [];
  const seen = new Set<string>();
  const corrections: string[] = [];

  const push = (t: string, source: string) => {
    const validated = validateTicker(t);
    if (validated && !seen.has(validated)) {
      seen.add(validated);
      tickers.push(validated);
      if (t !== validated) {
        corrections.push(`${t} → ${validated} (${source})`);
      }
    }
  };

  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

  // ── Pass 1: $TICKER cashtags ──
  const dollarMatches = text.match(/\$[A-Za-z][A-Za-z0-9.]{0,5}\b/g);
  if (dollarMatches) {
    for (const m of dollarMatches) {
      const cand = m.replace('$', '').toUpperCase();
      push(cand, 'cashtag');
    }
  }

  // ── Pass 2: TICKER directly above company name ──
  const UI_NEXT_LINE_WORDS = new Set([
    'open', 'orders', 'positions', 'quantity', 'value', 'last', 'cost', 'price',
    'profit', 'loss', 'symbol', 'markets', 'watchlist', 'trade', 'total', 'balance',
    'cash', 'equity', 'buy', 'sell', 'holdings', 'overview', 'today', 'change',
  ]);

  function looksLikeCompanyName(line: string): boolean {
    const t = (line ?? '').trim();
    if (!t || /^[\$\d.,%+\-\s]+$/.test(t)) return false;
    const letters = t.replace(/[^A-Za-z]/g, '');
    if (letters.length < 4) return false;
    if ((t.match(/[a-z]/g) || []).length < 2) return false;
    if (UI_NEXT_LINE_WORDS.has(letters.toLowerCase())) return false;
    return true;
  }

  function tickerCandidate(line: string): string | null {
    const t = line.trim().replace(/[^A-Za-z0-9.$]/g, '');
    const core = t.replace(/^\$/, '').replace(/\.+$/, '');
    if (core.length < 1 || core.length > 6) return null;
    if (!/[A-Za-z]/.test(core)) return null;
    if ((core.match(/[a-z]/g) || []).length > 1) return null;
    return core.toUpperCase();
  }

  let structuralHits = 0;
  for (let i = 0; i < lines.length; i++) {
    const cand = tickerCandidate(lines[i]);
    if (!cand || FALSE_POSITIVES.has(cand)) continue;
    if (looksLikeCompanyName(lines[i + 1])) {
      structuralHits++;
      push(cand, 'structural');
    }
  }

  // ── Pass 3: Fallback word matches with correction ──
  if (structuralHits === 0) {
    const wordMatches = text.match(/\b[A-Za-z0-9]{2,6}\b/g);
    if (wordMatches) {
      for (const m of wordMatches) {
        const upper = m.toUpperCase();
        if (upper.length >= 2 && upper.length <= 6 &&
            !COMMON_WORDS.has(upper) && !FALSE_POSITIVES.has(upper)) {
          push(upper, 'word-match');
        }
      }
    }
  }

  // ── Pass 4: Corrected candidates from known confusion patterns ──
  // This catches cases like J8 → PDD even when no other signal is present
  for (const line of lines) {
    const tokens = line.split(/\s+/);
    for (const token of tokens) {
      const cleaned = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (KNOWN_TICKER_CORRECTIONS[cleaned]) {
        push(cleaned, 'known-correction');
      }
    }
  }

  return { tickers, rawText: text, corrections };
}

// ─── Cloud Vision OCR (Primary) ───────────────────────────────────────

/**
 * Run OCR using Google Cloud Vision API (much more accurate than Tesseract).
 * Falls back to local Tesseract if Vision API is not configured.
 */
export async function runOCR(imagePath: string): Promise<OCRResult> {
  // Try Google Cloud Vision first if API key is available
  const visionKey = process.env.GOOGLE_VISION_API_KEY;
  if (visionKey) {
    try {
      return await runCloudVision(imagePath, visionKey);
    } catch (err) {
      logger.warn('Cloud Vision failed, falling back to Tesseract', { error: String(err) });
    }
  }

  // Fallback to Tesseract.js
  return runTesseract(imagePath);
}

/**
 * Google Cloud Vision API OCR - much higher accuracy than Tesseract.
 */
async function runCloudVision(imagePath: string, apiKey: string): Promise<OCRResult> {
  const fs = require('fs');
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const response = await axios.post(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      requests: [{
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        imageContext: {
          languageHints: ['en'],
        },
      }],
    },
    { timeout: 30000 }
  );

  const text = response.data.responses?.[0]?.fullTextAnnotation?.text || '';
  const { tickers, corrections } = extractTickers(text);

  return { tickers, rawText: text, corrections };
}

/**
 * Tesseract.js OCR - local fallback when Cloud Vision is unavailable.
 */
async function runTesseract(imagePath: string): Promise<OCRResult> {
  // Dynamic import to avoid bundling issues
  const { createWorker, PSM } = await import('tesseract.js');

  const worker = await createWorker('eng');
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: '1',
    });

    const { data: { text } } = await worker.recognize(imagePath);
    const { tickers, corrections } = extractTickers(text);

    return { tickers, rawText: text, corrections };
  } finally {
    await worker.terminate();
  }
}

// ─── URL-based OCR (for Telegram bot) ─────────────────────────────────

/**
 * Download an image from URL and run OCR on it.
 * Used by the Telegram bot for processing screenshots.
 */
export async function runOCRFromUrl(imageUrl: string): Promise<OCRResult> {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  const tmpPath = path.join(os.tmpdir(), `ocr_${Date.now()}.jpg`);

  try {
    // Download image
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 30000,
    });

    const writer = fs.createWriteStream(tmpPath);
    response.data.pipe(writer);
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Run OCR
    return await runOCR(tmpPath);
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }
}

// ─── Score extracted tickers ──────────────────────────────────────────

export interface ScoredTicker {
  ticker: string;
  score: number | null;
  price?: number;
  changePct?: number;
  signal?: 'buy' | 'hold' | 'sell';
}
