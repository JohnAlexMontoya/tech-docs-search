import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '../documents/entities/document.entity';
import { FileStorageService } from '../documents/file-storage.service';
import { DocumentEventsPublisher } from '../notifications/document-events.publisher';
import { DocumentProcessor } from './document.processor';
import { PdfTextExtractor } from './extractors/pdf.extractor';
import { PlainTextExtractor } from './extractors/plain-text.extractor';
import { TEXT_EXTRACTORS, TextExtractorRegistry } from './extractors/text-extractor';
import { DOCUMENT_QUEUE } from './processing.constants';
import { TextAnalyzerService } from './text-analyzer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
  ],
  providers: [
    DocumentProcessor,
    TextAnalyzerService,
    FileStorageService,
    DocumentEventsPublisher,
    PdfTextExtractor,
    PlainTextExtractor,
    {
      provide: TEXT_EXTRACTORS,
      useFactory: (pdf: PdfTextExtractor, plain: PlainTextExtractor) => [pdf, plain],
      inject: [PdfTextExtractor, PlainTextExtractor],
    },
    TextExtractorRegistry,
  ],
})
export class ProcessingModule {}
