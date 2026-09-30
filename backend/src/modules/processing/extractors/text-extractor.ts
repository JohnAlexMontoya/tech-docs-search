import { Inject, Injectable } from '@nestjs/common';
import { UnrecoverableError } from 'bullmq';

export const TEXT_EXTRACTORS = Symbol('TEXT_EXTRACTORS');

/** Strategy: cada formato implementa su propia extracción de texto. */
export interface TextExtractor {
  supports(mimeType: string): boolean;
  extract(buffer: Buffer): Promise<string>;
}

@Injectable()
export class TextExtractorRegistry {
  constructor(@Inject(TEXT_EXTRACTORS) private readonly extractors: TextExtractor[]) {}

  for(mimeType: string): TextExtractor {
    const extractor = this.extractors.find((e) => e.supports(mimeType));
    if (!extractor) throw new UnrecoverableError(`No hay extractor para el tipo ${mimeType}`);
    return extractor;
  }
}
