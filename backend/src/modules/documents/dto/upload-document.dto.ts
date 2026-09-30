import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength,
} from 'class-validator';

export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Acepta "a,b,c" (multipart) o un arreglo; normaliza a minúsculas y elimina duplicados
export const toTagList = ({ value }: { value: unknown }) => {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  return [...new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
};

/** Metadatos comunes: aplican a cada archivo de una carga masiva. */
export class BatchUploadDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  author!: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  category!: string;

  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(30)
  version!: string;

  @IsOptional()
  @Transform(toTagList)
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(50, { each: true })
  tags?: string[];
}

/** Carga individual: agrega el título. */
export class UploadDocumentDto extends BatchUploadDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(255)
  title!: string;
}
