import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import type { DocumentStatus } from '@tech-docs/shared';
import { DOCUMENT_STATUSES } from '../entities/document.entity';

export class ListDocumentsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  pageSize = 10;

  @IsOptional() @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatus;
}
