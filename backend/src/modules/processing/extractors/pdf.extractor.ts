import { Injectable } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { TextExtractor } from './text-extractor';

@Injectable()
export class PdfTextExtractor implements TextExtractor {
  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  async extract(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }
}
