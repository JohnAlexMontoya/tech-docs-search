import { Injectable } from '@nestjs/common';
import { TextExtractor } from './text-extractor';

@Injectable()
export class PlainTextExtractor implements TextExtractor {
  supports(mimeType: string): boolean {
    return mimeType === 'text/plain' || mimeType === 'text/markdown';
  }

  extract(buffer: Buffer): Promise<string> {
    return Promise.resolve(buffer.toString('utf8'));
  }
}
