import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  BatchUploadResultDto, DocumentDetailDto, DocumentListItemDto,
  PaginatedResponse, SearchHitDto, UploadAcceptedDto,
} from '@tech-docs/shared';
import { Observable } from 'rxjs';

const API_URL = '/api';

export interface SearchParams {
  q: string;
  page: number;
  pageSize: number;
  category?: string;
  tags?: string[];
}

export interface BatchMetadata {
  author: string;
  category: string;
  version: string;
  tags: string; // "a, b, c"
}

export interface UploadMetadata extends BatchMetadata {
  title: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);

  search(params: SearchParams): Observable<PaginatedResponse<SearchHitDto>> {
    let httpParams = new HttpParams()
      .set('q', params.q)
      .set('page', params.page)
      .set('pageSize', params.pageSize);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.tags?.length) httpParams = httpParams.set('tags', params.tags.join(','));
    return this.http.get<PaginatedResponse<SearchHitDto>>(`${API_URL}/search`, { params: httpParams });
  }

  categories(): Observable<string[]> {
    return this.http.get<string[]>(`${API_URL}/documents/categories`);
  }

  list(page = 1, pageSize = 15): Observable<PaginatedResponse<DocumentListItemDto>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResponse<DocumentListItemDto>>(`${API_URL}/documents`, { params });
  }

  get(id: string): Observable<DocumentDetailDto> {
    return this.http.get<DocumentDetailDto>(`${API_URL}/documents/${id}`);
  }

  upload(file: File, meta: UploadMetadata): Observable<UploadAcceptedDto> {
    const form = this.toFormData(meta);
    form.append('file', file, file.name);
    return this.http.post<UploadAcceptedDto>(`${API_URL}/documents`, form);
  }

  uploadBatch(files: File[], meta: BatchMetadata): Observable<BatchUploadResultDto> {
    const form = this.toFormData(meta);
    files.forEach((file) => form.append('files', file, file.name));
    return this.http.post<BatchUploadResultDto>(`${API_URL}/documents/batch`, form);
  }

  private toFormData(meta: BatchMetadata | UploadMetadata): FormData {
    const form = new FormData();
    Object.entries(meta).forEach(([key, value]) => {
      if (value) form.append(key, value);
    });
    return form;
  }
}
