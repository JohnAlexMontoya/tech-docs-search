import {
  BadRequestException, Body, Controller, HttpCode, HttpStatus, Post,
  UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { BatchUploadResultDto, UploadAcceptedDto } from '@tech-docs/shared';
import { DocumentsService } from './documents.service';
import { BatchUploadDto, UploadDocumentDto } from './dto/upload-document.dto';

export const MAX_BATCH_FILES = 20;

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /** HU-01: carga individual. Responde 202 de inmediato; el procesamiento es asíncrono. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadDocumentDto,
  ): Promise<UploadAcceptedDto> {
    if (!file) throw new BadRequestException('El campo "file" es obligatorio');
    return this.documents.upload(file, dto);
  }

  /** HU-01: carga masiva. Cada archivo se acepta o rechaza de forma independiente. */
  @Post('batch')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FilesInterceptor('files', MAX_BATCH_FILES))
  uploadBatch(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Body() dto: BatchUploadDto,
  ): Promise<BatchUploadResultDto> {
    if (!files?.length) throw new BadRequestException('Debe adjuntar al menos un archivo en "files"');
    return this.documents.uploadBatch(files, dto);
  }
}
