import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Almacenamiento en disco local (volumen compartido API/worker).
 * Guarda una clave relativa en BD para poder migrar a S3/Blob sin tocar los datos.
 */
@Injectable()
export class FileStorageService {
  private readonly baseDir: string;

  constructor(config: ConfigService) {
    this.baseDir = resolve(config.get<string>('UPLOAD_DIR', './storage'));
  }

  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(this.baseDir, { recursive: true });
    const key = `${randomUUID()}${extension}`;
    await writeFile(join(this.baseDir, key), buffer);
    return key;
  }

  read(key: string): Promise<Buffer> {
    return readFile(join(this.baseDir, key));
  }

  async remove(key: string): Promise<void> {
    await rm(join(this.baseDir, key), { force: true });
  }
}
