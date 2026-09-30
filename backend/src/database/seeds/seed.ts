/**
 * Seed de volumen para validar la latencia de búsqueda.
 * Inserta por lotes con unnest (un round-trip por lote) y construye el tsvector en SQL.
 * Uso: pnpm --filter backend seed 10000
 */
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import dataSource from '../../config/data-source';

const TOTAL = Number(process.argv[2] ?? 10_000);
const BATCH = 500;

const CATEGORIES = ['Arquitectura', 'DevOps', 'Seguridad', 'Bases de datos', 'Frontend', 'Backend', 'Cloud', 'Testing'];
const TAGS = ['docker', 'kubernetes', 'nestjs', 'angular', 'postgresql', 'redis', 'aws', 'azure', 'microservicios',
  'api', 'rest', 'graphql', 'ci-cd', 'oauth', 'performance', 'cache', 'observabilidad', 'terraform'];
const AUTHORS = ['Ana Gómez', 'Carlos Ruiz', 'Laura Pérez', 'Andrés Torres', 'María López', 'Julián Castro'];
const VOCAB = ('arquitectura hexagonal microservicios contenedores docker kubernetes despliegue continuo integración ' +
  'pipeline seguridad autenticación oauth token cifrado base datos consultas índices rendimiento cache redis cola ' +
  'mensajes eventos api rest graphql endpoint servidor cliente angular componentes servicio módulo pruebas unitarias ' +
  'monitoreo métricas logs escalabilidad disponibilidad réplica balanceador red latencia configuración entorno ' +
  'variables versión documentación manual especificación diseño patrón repositorio transacción concurrencia bloqueo ' +
  'migración esquema backup recuperación nube aws azure terraform infraestructura código calidad refactorización ' +
  'sistema usuario permisos roles auditoría de la el para con y en los las del').split(' ');

const VECTOR_SQL = `
  UPDATE documents d SET search_vector =
       setweight(to_tsvector('spanish', d.title), 'A')
    || setweight(to_tsvector('spanish',
         coalesce((SELECT string_agg(t.name, ' ') FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
                   WHERE dt.document_id = d.id), '') || ' ' || c.name || ' ' || d.author), 'B')
    || setweight(to_tsvector('spanish', coalesce(d.summary, '')), 'C')
    || setweight(to_tsvector('spanish', dc.body), 'D')
  FROM categories c, document_contents dc
  WHERE d.id = ANY($1::uuid[]) AND c.id = d.category_id AND dc.document_id = d.id`;

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function sentence(vocab: string[]): string {
  const words = Array.from({ length: 8 + Math.floor(Math.random() * 10) }, () => pick(vocab));
  words[0] = words[0][0].toUpperCase() + words[0].slice(1);
  return `${words.join(' ')}.`;
}

async function main(): Promise<void> {
  await dataSource.initialize();
  const started = Date.now();

  await dataSource.query(`INSERT INTO categories (name) SELECT unnest($1::text[]) ON CONFLICT (name) DO NOTHING`, [CATEGORIES]);
  await dataSource.query(`INSERT INTO tags (name) SELECT unnest($1::text[]) ON CONFLICT (name) DO NOTHING`, [TAGS]);
  const categoryIds = (await dataSource.query<{ id: string }[]>(`SELECT id FROM categories WHERE name = ANY($1)`, [CATEGORIES])).map((r) => r.id);
  const tagIds = (await dataSource.query<{ id: string }[]>(`SELECT id FROM tags WHERE name = ANY($1)`, [TAGS])).map((r) => r.id);

  for (let offset = 0; offset < TOTAL; offset += BATCH) {
    const size = Math.min(BATCH, TOTAL - offset);
    const ids: string[] = [], titles: string[] = [], authors: string[] = [], versions: string[] = [];
    const categories: string[] = [], hashes: string[] = [], bodies: string[] = [], summaries: string[] = [];
    const tagDocs: string[] = [], tagRefs: string[] = [];

    for (let i = 0; i < size; i++) {
      const id = randomUUID();
      const docVocab = Array.from({ length: 12 }, () => pick(VOCAB));
      const body = Array.from({ length: 30 }, () => sentence(docVocab)).join(' ');
      ids.push(id);
      titles.push(`Guía de ${pick(VOCAB)} y ${pick(VOCAB)} #${offset + i + 1}`);
      authors.push(pick(AUTHORS));
      versions.push(`${1 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 10)}`);
      categories.push(pick(categoryIds));
      hashes.push(createHash('sha256').update(id).digest('hex'));
      bodies.push(body);
      summaries.push(body.slice(0, 200));

      const first = pick(tagIds);
      let second = pick(tagIds);
      while (second === first) second = pick(tagIds);
      tagDocs.push(id, id);
      tagRefs.push(first, second);
    }

    await dataSource.transaction(async (m) => {
      await m.query(
        `INSERT INTO documents (id, title, author, version, category_id, file_name, mime_type, size_bytes,
                                file_hash, storage_path, status, summary, indexed_at)
         SELECT s.id, s.title, s.author, s.version, s.category_id, 'seed.md', 'text/markdown', length(s.body),
                s.hash, 'seed', 'INDEXADO', s.summary, now()
         FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::uuid[], $6::text[], $7::text[], $8::text[])
              AS s(id, title, author, version, category_id, hash, body, summary)`,
        [ids, titles, authors, versions, categories, hashes, bodies, summaries],
      );
      await m.query(`INSERT INTO document_contents (document_id, body) SELECT * FROM unnest($1::uuid[], $2::text[])`, [ids, bodies]);
      await m.query(`INSERT INTO document_tags (document_id, tag_id) SELECT * FROM unnest($1::uuid[], $2::uuid[])`, [tagDocs, tagRefs]);
      await m.query(VECTOR_SQL, [ids]);
    });

    process.stdout.write(`\r${offset + size}/${TOTAL} documentos`);
  }

  await dataSource.query('ANALYZE documents'); // estadísticas frescas para el planificador
  console.log(`\nSeed completado en ${((Date.now() - started) / 1000).toFixed(1)} s`);
  await dataSource.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
