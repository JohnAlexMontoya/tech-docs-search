import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchCriteria, SearchEngine, SearchEngineResult } from './search-engine.port';

export const HIGHLIGHT_START = '⟦';
export const HIGHLIGHT_END = '⟧';

// Texto máximo sobre el que se calcula el resaltado (ts_headline es la operación más costosa)
const HEADLINE_MAX_CHARS = 50_000;

/**
 * 1) query:   parsea la búsqueda con sintaxis tipo Google (websearch_to_tsquery)
 * 2) matches: usa el índice GIN (@@) + filtros por categoría/tags con JOIN y EXISTS
 * 3) page:    ranking + total con ventana (COUNT OVER) + paginación
 * 4) final:   joins de metadatos y ts_headline SOLO para las filas de la página
 */
const SEARCH_SQL = `
  WITH query AS (
    SELECT websearch_to_tsquery('spanish', $1) AS q
  ),
  matches AS (
    SELECT d.id, ts_rank_cd(d.search_vector, query.q, 32) AS rank
    FROM documents d
    CROSS JOIN query
    JOIN categories c ON c.id = d.category_id
    WHERE d.status = 'INDEXADO'
      AND d.search_vector @@ query.q
      AND ($2::text IS NULL OR c.name = $2)
      AND ($3::text[] IS NULL OR EXISTS (
            SELECT 1 FROM document_tags dt
            JOIN tags t ON t.id = dt.tag_id
            WHERE dt.document_id = d.id AND t.name = ANY($3)))
  ),
  page AS (
    SELECT id, rank, COUNT(*) OVER () AS total
    FROM matches
    ORDER BY rank DESC, id
    LIMIT $4 OFFSET $5
  )
  SELECT
    d.id, d.title, d.author, d.version, d.summary, d.created_at,
    c.name AS category,
    p.rank, p.total,
    ARRAY(SELECT t.name FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
          WHERE dt.document_id = d.id ORDER BY t.name) AS tags,
    ts_headline('spanish', left(dc.body, ${HEADLINE_MAX_CHARS}), query.q,
      'StartSel=${HIGHLIGHT_START}, StopSel=${HIGHLIGHT_END}, MaxFragments=2, MaxWords=35, MinWords=15, FragmentDelimiter=" … "'
    ) AS highlight
  FROM page p
  JOIN documents d          ON d.id = p.id
  JOIN categories c         ON c.id = d.category_id
  JOIN document_contents dc ON dc.document_id = d.id
  CROSS JOIN query
  ORDER BY p.rank DESC, d.id`;

interface SearchRow {
  id: string;
  title: string;
  author: string;
  version: string;
  summary: string | null;
  created_at: Date;
  category: string;
  rank: number;
  total: string; // bigint llega como string
  tags: string[];
  highlight: string;
}

@Injectable()
export class PostgresSearchEngine implements SearchEngine {
  constructor(private readonly dataSource: DataSource) {}

  async search(criteria: SearchCriteria): Promise<SearchEngineResult> {
    const rows = await this.dataSource.query<SearchRow[]>(SEARCH_SQL, [
      criteria.text,
      criteria.category ?? null,
      criteria.tags?.length ? criteria.tags : null,
      criteria.limit,
      criteria.offset,
    ]);

    return {
      total: rows.length ? Number(rows[0].total) : 0,
      hits: rows.map((r) => ({
        id: r.id,
        title: r.title,
        author: r.author,
        version: r.version,
        category: r.category,
        tags: r.tags,
        summary: r.summary,
        highlight: r.highlight,
        rank: Number(r.rank),
        createdAt: r.created_at,
      })),
    };
  }
}
