import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  DocumentDetailDto, DocumentListItemDto, PaginatedResponse,
} from '@tech-docs/shared';
import { performance } from 'node:perf_hooks';
import { DataSource, Repository } from 'typeorm';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { DocumentEntity } from './entities/document.entity';

/** Lado de lectura (CQS): consultas sin efectos secundarios. */
@Injectable()
export class DocumentsQueryService {
  constructor(
    @InjectRepository(DocumentEntity) private readonly documents: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<DocumentDetailDto> {
    const document = await this.documents.findOne({
      where: { id },
      relations: { category: true, tags: true, content: true },
    });
    if (!document) throw new NotFoundException(`Documento ${id} no encontrado`);

    return {
      ...this.toListItem(document),
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      summary: document.summary,
      keywords: document.keywords,
      body: document.content?.body ?? null,
    };
  }

  async list(query: ListDocumentsDto): Promise<PaginatedResponse<DocumentListItemDto>> {
    const started = performance.now();
    const [documents, total] = await this.documents.findAndCount({
      where: query.status ? { status: query.status } : {},
      relations: { category: true, tags: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    return {
      items: documents.map((d) => this.toListItem(d)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      tookMs: Math.round(performance.now() - started),
    };
  }

  async categories(): Promise<string[]> {
    const rows = await this.dataSource.query<{ name: string }[]>(
      'SELECT name FROM categories ORDER BY name',
    );
    return rows.map((r) => r.name);
  }

  private toListItem(d: DocumentEntity): DocumentListItemDto {
    return {
      id: d.id,
      title: d.title,
      author: d.author,
      version: d.version,
      category: d.category.name,
      tags: (d.tags ?? []).map((t) => t.name).sort(),
      status: d.status,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt.toISOString(),
      indexedAt: d.indexedAt?.toISOString() ?? null,
    };
  }
}
