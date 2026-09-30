import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { DocumentEntity } from './document.entity';

@Entity('document_contents')
export class DocumentContentEntity {
  @PrimaryColumn({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @OneToOne(() => DocumentEntity, (d) => d.content, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: DocumentEntity;

  @Column({ type: 'text' })
  body!: string;
}
