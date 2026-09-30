import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { toTagList, trim } from '../../documents/dto/upload-document.dto';

export class SearchDocumentsDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(200)
  q!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  pageSize = 10;

  @IsOptional() @Transform(trim) @IsString() @MaxLength(100)
  category?: string;

  @IsOptional() @Transform(toTagList) @IsArray() @IsString({ each: true })
  tags?: string[];
}
