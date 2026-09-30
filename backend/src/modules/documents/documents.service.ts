import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException, ConflictException, HttpException, Injectable, Logger,
  ServiceUnavailableException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { BatchUploadResultDto, UploadAcceptedDto } from '@tech-docs/shared';
import { Queue } from 'bullmq';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import {
  DOCUMENT_QUEUE, PROCESS_DOCUMENT_JOB, ProcessDocumentJob,
} from '../processing/processing.constants';
import { BatchUploadDto, UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentEntity } from './entities/document.entity';
import { FileStorageService } from './file-storage.service';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
};
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(DocumentEntity) private readonly documents: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly storage: FileStorageService,
    @InjectQueue(DOCUMENT_QUEUE) private readonly queue: Queue<ProcessDocumentJob>,
  ) {}

  async upload(file: Express.Multer.File, meta: UploadDocumentDto): Promise<UploadAcceptedDto> {
    // Multer decodifica el nombre como latin1: se corrige para soportar tildes y ñ
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const extension = this.validateFile(file, fileName);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    const existing = await this.documents.findOne({ where: { fileHash }, select: { id: true } });
    if (existing) {
      throw new ConflictException({
        message: `El archivo "${fileName}" ya fue cargado`,
        documentId: existing.id,
      });
    }

    const storagePath = await this.storage.save(file.buffer, extension);
    let document: DocumentEntity;
    try {
      document = await this.dataSource.transaction(async (manager) => {
        const categoryId = await this.upsertCategory(manager, meta.category);
        const tags = await this.upsertTags(manager, meta.tags ?? []);
        return manager.save(
          manager.create(DocumentEntity, {
            title: meta.title,
            author: meta.author,
            version: meta.version,
            categoryId,
            tags,
            fileName,
            mimeType: MIME_BY_EXTENSION[extension],
            sizeBytes: file.size,
            fileHash,
            storagePath,
            status: 'PROCESANDO',
          }),
        );
      });
    } catch (error) {
      await this.storage.remove(storagePath);
      // Carrera entre dos cargas simultáneas del mismo archivo: la restricción UNIQUE decide
      if (error instanceof QueryFailedError &&
          (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(`El archivo "${fileName}" ya fue cargado`);
      }
      throw error;
    }

    await this.enqueue(document.id);
    return { id: document.id, fileName: document.fileName, status: 'PROCESANDO' };
  }

  async uploadBatch(files: Express.Multer.File[], meta: BatchUploadDto): Promise<BatchUploadResultDto> {
    const results = await Promise.allSettled(
      files.map((file) => {
        const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
        return this.upload(file, { ...meta, title: basename(name, extname(name)) });
      }),
    );

    return results.reduce<BatchUploadResultDto>(
      (acc, result, i) => {
        if (result.status === 'fulfilled') {
          acc.accepted.push(result.value);
        } else {
          acc.rejected.push({
            fileName: Buffer.from(files[i].originalname, 'latin1').toString('utf8'),
            reason: result.reason instanceof HttpException ? result.reason.message : 'Error interno',
          });
        }
        return acc;
      },
      { accepted: [], rejected: [] },
    );
  }

  private validateFile(file: Express.Multer.File, fileName: string): string {
    const extension = extname(fileName).toLowerCase();
    if (!MIME_BY_EXTENSION[extension]) {
      throw new UnsupportedMediaTypeException(
        `Formato no soportado (${extension || 'sin extensión'}). Permitidos: PDF, TXT, MD`,
      );
    }
    if (file.size === 0) throw new BadRequestException('El archivo está vacío');
    // Firma binaria: evita un .exe renombrado a .pdf
    if (extension === '.pdf' && file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new UnsupportedMediaTypeException('El archivo no es un PDF válido');
    }
    return extension;
  }

  // INSERT ... ON CONFLICT: atómico y seguro ante cargas concurrentes
  private async upsertCategory(manager: EntityManager, name: string): Promise<string> {
    const [row] = await manager.query<{ id: string }[]>(
      `INSERT INTO categories (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [name],
    );
    return row.id;
  }

  private async upsertTags(manager: EntityManager, names: string[]): Promise<{ id: string; name: string }[]> {
    if (names.length === 0) return [];
    return manager.query<{ id: string; name: string }[]>(
      `INSERT INTO tags (name) SELECT unnest($1::text[])
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name`,
      [names],
    );
  }

  private async enqueue(documentId: string): Promise<void> {
    try {
      // jobId = documentId -> encolado idempotente
      await this.queue.add(PROCESS_DOCUMENT_JOB, { documentId }, { jobId: documentId });
    } catch (error) {
      this.logger.error(`No se pudo encolar ${documentId}`, error instanceof Error ? error.stack : undefined);
      await this.documents.update(documentId, {
        status: 'ERROR',
        errorMessage: 'No se pudo encolar el procesamiento',
      });
      throw new ServiceUnavailableException('El servicio de procesamiento no está disponible');
    }
  }
}
