// Contrato compartido Backend <-> Frontend (solo tipos, sin runtime)

export type DocumentStatus = 'PROCESANDO' | 'INDEXADO' | 'ERROR';

export interface UploadAcceptedDto {
  id: string;
  fileName: string;
  status: DocumentStatus;
}

export interface BatchUploadResultDto {
  accepted: UploadAcceptedDto[];
  rejected: { fileName: string; reason: string }[];
}

export interface DocumentStatusEvent {
  documentId: string;
  title: string;
  status: DocumentStatus;
  errorMessage: string | null;
  occurredAt: string;
}

export interface SearchHitDto {
  id: string;
  title: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  summary: string | null;
  highlight: string;
  rank: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  tookMs: number;
}

export interface DocumentDetailDto {
  id: string;
  title: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  errorMessage: string | null;
  summary: string | null;
  keywords: string[];
  body: string | null;
  createdAt: string;
  indexedAt: string | null;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  path: string;
  timestamp: string;
}

export interface DocumentListItemDto {
  id: string;
  title: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  status: DocumentStatus;
  errorMessage: string | null;
  createdAt: string;
  indexedAt: string | null;
}
