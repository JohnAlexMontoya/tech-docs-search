import {
  ConflictException, ServiceUnavailableException, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PROCESS_DOCUMENT_JOB } from '../processing/processing.constants';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

const file = (name: string, content: string): Express.Multer.File =>
  ({ originalname: name, buffer: Buffer.from(content), size: Buffer.byteLength(content) }) as Express.Multer.File;

describe('DocumentsService', () => {
  const meta: UploadDocumentDto = { title: 'Manual', author: 'John', category: 'DevOps', version: '1.0', tags: ['docker'] };

  let repository: { findOne: jest.Mock; update: jest.Mock };
  let manager: { query: jest.Mock; create: jest.Mock; save: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let storage: { save: jest.Mock; remove: jest.Mock };
  let queue: { add: jest.Mock };
  let service: DocumentsService;

  beforeEach(() => {
    repository = { findOne: jest.fn().mockResolvedValue(null), update: jest.fn() };
    manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{ id: 'cat-1' }]) // upsert categoría
        .mockResolvedValueOnce([{ id: 'tag-1', name: 'docker' }]), // upsert tags
      create: jest.fn((_entity: unknown, data: object) => data),
      save: jest.fn((data: object) => Promise.resolve({ ...data, id: 'doc-1' })),
    };
    dataSource = { transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)) };
    storage = { save: jest.fn().mockResolvedValue('stored-key.md'), remove: jest.fn() };
    queue = { add: jest.fn().mockResolvedValue({}) };

    service = new DocumentsService(repository as never, dataSource as never, storage as never, queue as never);
  });

  it('acepta un markdown válido, lo persiste y lo encola con jobId idempotente', async () => {
    const result = await service.upload(file('guia.md', '# Guía de despliegue'), meta);

    expect(result).toEqual({ id: 'doc-1', fileName: 'guia.md', status: 'PROCESANDO' });
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'text/markdown', categoryId: 'cat-1', status: 'PROCESANDO' }),
    );
    expect(queue.add).toHaveBeenCalledWith(PROCESS_DOCUMENT_JOB, { documentId: 'doc-1' }, { jobId: 'doc-1' });
  });

  it('rechaza formatos no soportados sin guardar el archivo', async () => {
    await expect(service.upload(file('virus.exe', 'MZ'), meta)).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rechaza un .pdf sin la firma binaria %PDF-', async () => {
    await expect(service.upload(file('falso.pdf', 'no soy un pdf'), meta)).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
  });

  it('responde 409 si el mismo contenido ya fue cargado (hash SHA-256)', async () => {
    repository.findOne.mockResolvedValue({ id: 'existing' });
    await expect(service.upload(file('guia.md', '# Guía'), meta)).rejects.toBeInstanceOf(ConflictException);
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('traduce la violación de unicidad de una carga concurrente a 409 y limpia el archivo', async () => {
    const uniqueViolation = new QueryFailedError('INSERT', [], Object.assign(new Error('duplicate'), { code: '23505' }));
    dataSource.transaction.mockRejectedValue(uniqueViolation);

    await expect(service.upload(file('guia.md', '# Guía'), meta)).rejects.toBeInstanceOf(ConflictException);
    expect(storage.remove).toHaveBeenCalledWith('stored-key.md');
  });

  it('marca el documento en ERROR y responde 503 si la cola no está disponible', async () => {
    queue.add.mockRejectedValue(new Error('Redis caído'));

    await expect(service.upload(file('guia.md', '# Guía'), meta)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(repository.update).toHaveBeenCalledWith('doc-1', expect.objectContaining({ status: 'ERROR' }));
  });

  it('corrige nombres de archivo con tildes que Multer decodifica como latin1', async () => {
    const latin1Name = Buffer.from('guía técnica.md', 'utf8').toString('latin1');
    const result = await service.upload(file(latin1Name, '# Contenido'), meta);
    expect(result.fileName).toBe('guía técnica.md');
  });
});
