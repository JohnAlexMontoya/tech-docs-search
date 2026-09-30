import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param,
  ParseUUIDPipe, Post, Query, UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type {
  BatchUploadResultDto, DocumentDetailDto, DocumentListItemDto,
  PaginatedResponse, UploadAcceptedDto,
} from '@tech-docs/shared';
import { DocumentsQueryService } from './documents-query.service';
import { DocumentsService } from './documents.service';
import { ListDocumentsDto } from './dto/list-documents.dto';
import { BatchUploadDto, UploadDocumentDto } from './dto/upload-document.dto';

export const MAX_BATCH_FILES = 20;

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly queries: DocumentsQueryService,
  ) {}

  /** Listado reciente (panel de cargas y re-sincronización tras reconexión SSE). */
  @Get()
  list(@Query() query: ListDocumentsDto): Promise<PaginatedResponse<DocumentListItemDto>> {
    return this.queries.list(query);
  }

  @Get('categories')
  categories(): Promise<string[]> {
    return this.queries.categories();
  }

  /** HU-03: detalle con metadatos y contenido para el visor. */
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<DocumentDetailDto> {
    return this.queries.findById(id);
  }

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
