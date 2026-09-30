/**
 * Puerto del motor de búsqueda (DIP).
 * Hoy: PostgreSQL FTS. Mañana: Elasticsearch/OpenSearch sin tocar controlador ni servicio.
 */
export const SEARCH_ENGINE = Symbol('SEARCH_ENGINE');

export interface SearchCriteria {
  text: string;
  category?: string;
  tags?: string[];
  limit: number;
  offset: number;
}

export interface SearchEngineHit {
  id: string;
  title: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  summary: string | null;
  highlight: string;
  rank: number;
  createdAt: Date;
}

export interface SearchEngineResult {
  hits: SearchEngineHit[];
  total: number;
}

export interface SearchEngine {
  search(criteria: SearchCriteria): Promise<SearchEngineResult>;
}
