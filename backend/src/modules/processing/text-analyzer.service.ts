import { Injectable } from '@nestjs/common';

const STOPWORDS = new Set(
  (
    // Español
    'a al algo algunas algunos ante antes como con contra cual cuando de del desde donde dos el ella ellas ellos en entre era es esa esas ese eso esos esta estas este esto estos fue fueron ha han hasta hay la las le les lo los mas más me mi muy no nos o otra otro para pero por porque que qué se sea ser si sí sin sobre son su sus también tiene todo todos tu un una uno unos y ya cada puede pueden debe deben así solo sólo mismo' +
    ' ' +
    // Inglés (documentación técnica suele mezclar idiomas)
    'the and for with that this from are was were will can not but you your all any has have its into more than then there these they use used using which when while also'
  ).split(' '),
);

export interface TextAnalysis {
  summary: string;
  keywords: string[];
}

export interface AnalysisOptions {
  maxKeywords: number;
  maxSentences: number;
  maxSummaryLength: number;
}

const DEFAULTS: AnalysisOptions = { maxKeywords: 10, maxSentences: 3, maxSummaryLength: 600 };

/**
 * Resumen extractivo + palabras clave por frecuencia.
 * Determinista, sin dependencias externas y fácil de probar.
 */
@Injectable()
export class TextAnalyzerService {
  analyze(text: string, options: Partial<AnalysisOptions> = {}): TextAnalysis {
    const opts = { ...DEFAULTS, ...options };
    const normalized = text.replace(/[#>*`~]+/g, ' ').replace(/\s+/g, ' ').trim();
    const frequencies = this.termFrequencies(normalized);

    const keywords = [...frequencies.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, opts.maxKeywords)
      .map(([term]) => term);

    return { keywords, summary: this.summarize(normalized, frequencies, opts) };
  }

  tokenize(text: string): string[] {
    return text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [];
  }

  private termFrequencies(text: string): Map<string, number> {
    const frequencies = new Map<string, number>();
    for (const token of this.tokenize(text)) {
      if (token.length < 3 || STOPWORDS.has(token) || /^\d+$/.test(token)) continue;
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
    return frequencies;
  }

  private summarize(text: string, frequencies: Map<string, number>, opts: AnalysisOptions): string {
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s, index) => ({ text: s.trim(), index }))
      .filter((s) => s.text.length >= 20);

    if (sentences.length === 0) return this.truncate(text, opts.maxSummaryLength);

    // Puntaje = relevancia promedio de sus términos (no premia oraciones largas)
    const scored = sentences.map((s) => {
      const tokens = this.tokenize(s.text);
      const score = tokens.reduce((sum, t) => sum + (frequencies.get(t) ?? 0), 0) / (tokens.length || 1);
      return { ...s, score };
    });

    const selected = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.maxSentences)
      .sort((a, b) => a.index - b.index) // conserva el orden original
      .map((s) => s.text)
      .join(' ');

    return this.truncate(selected, opts.maxSummaryLength);
  }

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
  }
}
