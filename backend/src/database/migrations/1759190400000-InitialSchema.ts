import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1759190400000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TYPE document_status AS ENUM ('PROCESANDO', 'INDEXADO', 'ERROR')`);

    await q.query(`
      CREATE TABLE categories (
        id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(100) NOT NULL UNIQUE
      )`);

    await q.query(`
      CREATE TABLE tags (
        id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(50) NOT NULL UNIQUE
      )`);

    await q.query(`
      CREATE TABLE documents (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title         varchar(255) NOT NULL,
        author        varchar(150) NOT NULL,
        version       varchar(30)  NOT NULL,
        category_id   uuid NOT NULL REFERENCES categories(id),
        file_name     varchar(255) NOT NULL,
        mime_type     varchar(100) NOT NULL,
        size_bytes    integer NOT NULL CHECK (size_bytes > 0),
        file_hash     char(64) NOT NULL UNIQUE,
        storage_path  varchar(500) NOT NULL,
        status        document_status NOT NULL DEFAULT 'PROCESANDO',
        error_message text,
        summary       text,
        keywords      text[] NOT NULL DEFAULT '{}',
        search_vector tsvector,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        indexed_at    timestamptz
      )`);

    await q.query(`
      CREATE TABLE document_contents (
        document_id uuid PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
        body        text NOT NULL
      )`);

    await q.query(`
      CREATE TABLE document_tags (
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        tag_id      uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, tag_id)
      )`);

    // Índice invertido para Full-Text Search
    await q.query(`CREATE INDEX idx_documents_search_vector ON documents USING GIN (search_vector)`);
    await q.query(`CREATE INDEX idx_documents_status ON documents (status)`);
    await q.query(`CREATE INDEX idx_documents_category ON documents (category_id)`);
    await q.query(`CREATE INDEX idx_documents_created_at ON documents (created_at DESC)`);
    await q.query(`CREATE INDEX idx_document_tags_tag ON document_tags (tag_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE document_tags`);
    await q.query(`DROP TABLE document_contents`);
    await q.query(`DROP TABLE documents`);
    await q.query(`DROP TABLE tags`);
    await q.query(`DROP TABLE categories`);
    await q.query(`DROP TYPE document_status`);
  }
}
