import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Redis } from 'ioredis';
import { rm } from 'node:fs/promises';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { dataSourceOptions } from '../src/config/data-source';
import { WorkerModule } from '../src/worker.module';

/**
 * Integración de punta a punta contra Postgres y Redis reales:
 * API + worker en el mismo proceso, BD docs_test y Redis DB 1.
 */
describe('Documentos: carga → indexación → búsqueda (e2e)', () => {
  let app: INestApplication;
  let worker: INestApplicationContext;

  const http = () => request(app.getHttpServer());

  const upload = (fileName: string, content: string, title = fileName) =>
    http()
      .post('/api/documents')
      .attach('file', Buffer.from(content), fileName)
      .field('title', title)
      .field('author', 'QA')
      .field('category', 'Pruebas')
      .field('version', '1.0')
      .field('tags', 'e2e,integracion');

  async function waitForStatus(id: string, expected: string, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const response = await http().get(`/api/documents/${id}`);
      if (response.body.status === expected) return response.body;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`El documento ${id} no llegó a ${expected} en ${timeoutMs} ms`);
  }

  beforeAll(async () => {
    // Esquema limpio en cada ejecución
    const dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
    await dataSource.dropDatabase();
    await dataSource.runMigrations();
    await dataSource.destroy();

    const redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      db: 1,
    });
    await redis.flushdb();
    await redis.quit();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();

    worker = await NestFactory.createApplicationContext(WorkerModule, { logger: false });
  });

  afterAll(async () => {
    await worker?.close();
    await app?.close();
    await rm('./storage-test', { recursive: true, force: true });
  });

  it('rechaza formatos no soportados con el formato de error uniforme', async () => {
    const response = await upload('malware.exe', 'MZ');

    expect(response.status).toBe(415);
    expect(response.body).toEqual(
      expect.objectContaining({ statusCode: 415, path: '/api/documents', timestamp: expect.any(String) }),
    );
  });

  it('valida los metadatos obligatorios', async () => {
    const response = await http().post('/api/documents').attach('file', Buffer.from('# Hola'), 'hola.md');

    expect(response.status).toBe(400);
    expect(response.body.message).toEqual(expect.arrayContaining([expect.stringContaining('title')]));
  });

  it('flujo completo: 202 PROCESANDO → INDEXADO → encontrable con resaltado → detalle', async () => {
    const accepted = await upload(
      'quetzal.md',
      '# Manual Quetzalcoatl\n\nEl servicio Quetzalcoatl despliega microservicios en Kubernetes.',
      'Manual Quetzalcoatl',
    );
    expect(accepted.status).toBe(202);
    expect(accepted.body).toEqual(expect.objectContaining({ id: expect.any(String), status: 'PROCESANDO' }));

    const detail = await waitForStatus(accepted.body.id, 'INDEXADO');
    expect(detail.body).toContain('Quetzalcoatl');
    expect(detail.keywords).toContain('quetzalcoatl');
    expect(detail.tags).toEqual(['e2e', 'integracion']);

    const search = await http().get('/api/search').query({ q: 'quetzalcoatl' });
    expect(search.status).toBe(200);
    expect(search.body.total).toBe(1);
    expect(search.body.items[0].title).toBe('Manual Quetzalcoatl');
    expect(search.body.items[0].highlight).toContain('<mark>');
    expect(search.body.tookMs).toBeLessThan(1000);
  });

  it('detecta duplicados por contenido (409)', async () => {
    const content = '# Documento único para prueba de duplicados';
    const first = await upload('original.md', content);
    const second = await upload('copia.md', content);

    expect(first.status).toBe(202);
    expect(second.status).toBe(409);
  });

  it('escapa el HTML del contenido en el resaltado (XSS)', async () => {
    const accepted = await upload('xss.md', 'Texto con <script>alert(1)</script> y la palabra zanahoria.');
    await waitForStatus(accepted.body.id, 'INDEXADO');

    const search = await http().get('/api/search').query({ q: 'zanahoria' });
    const highlight: string = search.body.items[0].highlight;
    expect(highlight).not.toContain('<script>');
    expect(highlight.replaceAll('<mark>', '').replaceAll('</mark>', '')).not.toMatch(/[<>]/); // Postgres ya descarta etiquetas; el único HTML permitido es <mark>
  });

  it('filtra por categoría y rechaza búsquedas demasiado cortas', async () => {
    const filtered = await http().get('/api/search').query({ q: 'quetzalcoatl', category: 'Inexistente' });
    expect(filtered.body.total).toBe(0);

    const tooShort = await http().get('/api/search').query({ q: 'a' });
    expect(tooShort.status).toBe(400);
  });

  it('marca ERROR un PDF corrupto tras agotar los reintentos', async () => {
    const accepted = await upload('roto.pdf', '%PDF-1.4 contenido corrupto');
    const detail = await waitForStatus(accepted.body.id, 'ERROR');
    expect(detail.errorMessage).toBeTruthy();
  });
});
