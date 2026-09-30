import {
  Column, CreateDateColumn, Entity, JoinColumn, JoinTable, ManyToMany,
  ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { DocumentStatus } from '@tech-docs/shared';
import { CategoryEntity } from './category.entity';
import { TagEntity } from './tag.entity';
import { DocumentContentEntity } from './document-content.entity';

export const DOCUMENT_STATUSES: DocumentStatus[] = ['PROCESANDO', 'INDEXADO', 'ERROR'];

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 150 })
  author!: string;

  @Column({ type: 'varchar', length: 30 })
  version!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @ManyToOne(() => CategoryEntity, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category!: CategoryEntity;

  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'document_tags',
    joinColumn: { name: 'document_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: TagEntity[];

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;

  @Column({ name: 'file_hash', type: 'char', length: 64, unique: true })
  fileHash!: string;

  @Column({ name: 'storage_path', type: 'varchar', length: 500 })
  storagePath!: string;

  @Column({ type: 'enum', enum: DOCUMENT_STATUSES, enumName: 'document_status', default: 'PROCESANDO' })
  status!: DocumentStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  keywords!: string[];

  @Column({ name: 'search_vector', type: 'tsvector', nullable: true, select: false })
  searchVector!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'indexed_at', type: 'timestamptz', nullable: true })
  indexedAt!: Date | null;

  @OneToOne(() => DocumentContentEntity, (c) => c.document)
  content?: DocumentContentEntity;
}
