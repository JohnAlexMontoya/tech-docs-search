import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, UnrecoverableError } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { DocumentEntity } from '../documents/entities/document.entity';
import { FileStorageService } from '../documents/file-storage.service';
import { DocumentEventsPublisher } from '../notifications/document-events.publisher';
import { TextExtractorRegistry } from './extractors/text-extractor';
import { DOCUMENT_QUEUE, ProcessDocumentJob } from './processing.constants';
import { TextAnalyzerService } from './text-analyzer.service';

// Límite de texto para el tsvector (Postgres admite máx. 1 MB por tsvector)
const MAX_INDEXED_CHARS = 500_000;

// Vector ponderado: A título | B tags, categoría y autor | C resumen y keywords | D contenido
const INDEX_DOCUMENT_SQL = `
  UPDATE documents d SET
    summary  = $2,
    keywords = $3,
    search_vector =
         setweight(to_tsvector('spanish', d.title), 'A')
      || setweight(to_tsvector('spanish',
           coalesce((SELECT string_agg(t.name, ' ')
                     FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
                     WHERE dt.document_id = d.id), '')
           || ' ' || c.name || ' ' || d.author), 'B')
      || setweight(to_tsvector('spanish', $2 || ' ' || array_to_string($3::text[], ' ')), 'C')
      || setweight(to_tsvector('spanish',
           (SELECT left(dc.body, ${MAX_INDEXED_CHARS}) FROM document_contents dc
            WHERE dc.document_id = d.id)), 'D'),
    status        = 'INDEXADO',
    indexed_at    = now(),
    updated_at    = now(),
    error_message = NULL
  FROM categories c
  WHERE d.id = $1 AND c.id = d.category_id AND d.status = 'PROCESANDO'`;

@Processor(DOCUMENT_QUEUE, { concurrency: Number(process.env.WORKER_CONCURRENCY ?? 4) })
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(
    @InjectRepository(DocumentEntity) private readonly documents: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly storage: FileStorageService,
    private readonly extractors: TextExtractorRegistry,
    private readonly analyzer: TextAnalyzerService,
    private readonly events: DocumentEventsPublisher,
  ) {
    super();
  }

  async process(job: Job<ProcessDocumentJob>): Promise<void> {
    const { documentId } = job.data;
    const started = Date.now();

    const document = await this.documents.findOne({
      where: { id: documentId },
      select: { id: true, title: true, mimeType: true, storagePath: true, status: true },
    });
    if (!document) throw new UnrecoverableError(`El documento ${documentId} no existe`);
    if (document.status !== 'PROCESANDO') {
      this.logger.warn(`Documento ${documentId} ya en estado ${document.status}; se omite`);
      return; // idempotente ante reentregas
    }

    const buffer = await this.storage.read(document.storagePath);
    const raw = await this.extractors.for(document.mimeType).extract(buffer);
    const text = raw.replace(/\u0000/g, '').trim(); // Postgres no admite NUL en text
    if (!text) {
      throw new UnrecoverableError('El documento no contiene texto extraíble (¿PDF escaneado?)');
    }

    const { summary, keywords } = this.analyzer.analyze(text);

    const indexed = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO document_contents (document_id, body) VALUES ($1, $2)
         ON CONFLICT (document_id) DO UPDATE SET body = EXCLUDED.body`,
        [documentId, text],
      );
      const [, affected] = (await manager.query(INDEX_DOCUMENT_SQL, [documentId, summary, keywords])) as [unknown, number];
      return affected > 0;
    });

    if (!indexed) {
      this.logger.warn(`Documento ${documentId} cambió de estado durante el procesamiento; se omite`);
      return;
    }

    await this.events.publish({
      documentId,
      title: document.title,
      status: 'INDEXADO',
      errorMessage: null,
      occurredAt: new Date().toISOString(),
    });
    this.logger.log(`Indexado ${documentId} en ${Date.now() - started} ms`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ProcessDocumentJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const { documentId } = job.data;
    const isFinal = error.name === 'UnrecoverableError' || job.attemptsMade >= (job.opts.attempts ?? 1);

    if (!isFinal) {
      this.logger.warn(`Intento ${job.attemptsMade} fallido para ${documentId}: ${error.message}. Se reintentará`);
      return;
    }

    this.logger.error(`Procesamiento fallido definitivamente para ${documentId}: ${error.message}`);
    const errorMessage = error.message.slice(0, 500);
    const result = await this.documents.update({ id: documentId, status: 'PROCESANDO' }, { status: 'ERROR', errorMessage });

    if (result.affected) {
      const document = await this.documents.findOne({ where: { id: documentId }, select: { id: true, title: true } });
      await this.events.publish({
        documentId,
        title: document?.title ?? '',
        status: 'ERROR',
        errorMessage,
        occurredAt: new Date().toISOString(),
      });
    }
  }
}
