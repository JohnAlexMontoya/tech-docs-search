import { UnrecoverableError } from 'bullmq';
import { PdfTextExtractor } from './pdf.extractor';
import { PlainTextExtractor } from './plain-text.extractor';
import { TextExtractorRegistry } from './text-extractor';

describe('TextExtractorRegistry', () => {
  const pdf = new PdfTextExtractor();
  const plain = new PlainTextExtractor();
  const registry = new TextExtractorRegistry([pdf, plain]);

  it.each([
    ['application/pdf', pdf],
    ['text/plain', plain],
    ['text/markdown', plain],
  ])('elige la estrategia correcta para %s', (mimeType, expected) => {
    expect(registry.for(mimeType)).toBe(expected);
  });

  it('lanza un error no recuperable si no hay estrategia para el tipo', () => {
    expect(() => registry.for('application/zip')).toThrow(UnrecoverableError);
  });

  it('el extractor de texto plano conserva tildes (UTF-8)', async () => {
    await expect(plain.extract(Buffer.from('Configuración básica', 'utf8'))).resolves.toBe('Configuración básica');
  });
});
