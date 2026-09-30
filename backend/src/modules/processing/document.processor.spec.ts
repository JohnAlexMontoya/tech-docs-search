import { Job, UnrecoverableError } from 'bullmq';
import { DocumentProcessor } from './document.processor';
import { ProcessDocumentJob } from './processing.constants';
import { TextAnalyzerService } from './text-analyzer.service';

const job = (attemptsMade = 0) =>
  ({ data: { documentId: 'doc-1' }, attemptsMade, opts: { attempts: 3 } }) as unknown as Job<ProcessDocumentJob>;

describe('DocumentProcessor', () => {
  let repository: { findOne: jest.Mock; update: jest.Mock };
  let manager: { query: jest.Mock };
  let extractor: { extract: jest.Mock };
  let events: { publish: jest.Mock };
  let storage: { read: jest.Mock };
  let processor: DocumentProcessor;

  const pendingDocument = {
    id: 'doc-1', title: 'Guía', mimeType: 'text/markdown', storagePath: 'k.md', status: 'PROCESANDO',
  };

  beforeEach(() => {
    repository = { findOne: jest.fn().mockResolvedValue(pendingDocument), update: jest.fn() };
    manager = { query: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([[], 1]) };
    extractor = { extract: jest.fn().mockResolvedValue('Kubernetes orquesta contenedores. Docker construye contenedores.') };
    events = { publish: jest.fn() };
    storage = { read: jest.fn().mockResolvedValue(Buffer.from('x')) };
    const dataSource = { transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)) };
    const registry = { for: jest.fn(() => extractor) };

    processor = new DocumentProcessor(
      repository as never, dataSource as never, storage as never,
      registry as never, new TextAnalyzerService(), events as never,
    );
  });

  it('extrae, analiza, indexa y publica el evento INDEXADO', async () => {
    await processor.process(job());

    expect(manager.query).toHaveBeenNthCalledWith(2, expect.stringContaining('setweight'), [
      'doc-1', expect.any(String), expect.arrayContaining(['contenedores']),
    ]);
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ documentId: 'doc-1', status: 'INDEXADO' }));
  });

  it('es idempotente: omite documentos que ya no están en PROCESANDO', async () => {
    repository.findOne.mockResolvedValue({ ...pendingDocument, status: 'INDEXADO' });
    await processor.process(job());

    expect(storage.read).not.toHaveBeenCalled();
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('no publica si otro worker cambió el estado durante el procesamiento (0 filas afectadas)', async () => {
    manager.query.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([[], 0]);
    await processor.process(job());
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('lanza un error no recuperable si el documento no tiene texto extraíble', async () => {
    extractor.extract.mockResolvedValue('   ');
    await expect(processor.process(job())).rejects.toThrow(UnrecoverableError);
  });

  it('no marca ERROR en un fallo transitorio con reintentos pendientes', async () => {
    await processor.onFailed(job(1), new Error('timeout'));
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('marca ERROR y publica el evento tras agotar los reintentos', async () => {
    repository.update.mockResolvedValue({ affected: 1 });
    await processor.onFailed(job(3), new Error('Invalid PDF structure.'));

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'doc-1', status: 'PROCESANDO' },
      { status: 'ERROR', errorMessage: 'Invalid PDF structure.' },
    );
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ status: 'ERROR' }));
  });

  it('un error no recuperable es definitivo desde el primer intento', async () => {
    repository.update.mockResolvedValue({ affected: 1 });
    await processor.onFailed(job(1), new UnrecoverableError('Sin texto'));
    expect(repository.update).toHaveBeenCalled();
  });
});
