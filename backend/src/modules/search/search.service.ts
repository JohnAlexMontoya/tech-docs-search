import { Inject, Injectable } from '@nestjs/common';
import type { PaginatedResponse, SearchHitDto } from '@tech-docs/shared';
import { performance } from 'node:perf_hooks';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { HIGHLIGHT_END, HIGHLIGHT_START } from './postgres-search.engine';
import { SEARCH_ENGINE } from './search-engine.port';
import type { SearchEngine } from './search-engine.port';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

/** Escapa el HTML del documento y solo después inserta <mark>: evita XSS en el resaltado. */
export function toSafeHighlight(fragment: string): string {
  return fragment
    .replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
    .replaceAll(HIGHLIGHT_START, '<mark>')
    .replaceAll(HIGHLIGHT_END, '</mark>');
}

@Injectable()
export class SearchService {
  constructor(@Inject(SEARCH_ENGINE) private readonly engine: SearchEngine) {}

  async search(dto: SearchDocumentsDto): Promise<PaginatedResponse<SearchHitDto>> {
    const started = performance.now();
    const { hits, total } = await this.engine.search({
      text: dto.q,
      category: dto.category,
      tags: dto.tags,
      limit: dto.pageSize,
      offset: (dto.page - 1) * dto.pageSize,
    });

    return {
      items: hits.map((h) => ({
        ...h,
        highlight: toSafeHighlight(h.highlight),
        createdAt: h.createdAt.toISOString(),
      })),
      total,
      page: dto.page,
      pageSize: dto.pageSize,
      tookMs: Math.round(performance.now() - started),
    };
  }
}
