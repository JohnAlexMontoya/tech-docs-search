import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DOCUMENT_QUEUE } from '../processing/processing.constants';
import { DocumentsController, MAX_BATCH_FILES } from './documents.controller';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentsService } from './documents.service';
import { DocumentEntity } from './entities/document.entity';
import { FileStorageService } from './file-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: Number(config.get('MAX_FILE_SIZE_MB', 20)) * 1024 * 1024,
          files: MAX_BATCH_FILES,
        },
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsQueryService, FileStorageService],
  exports: [FileStorageService],
})
export class DocumentsModule {}
