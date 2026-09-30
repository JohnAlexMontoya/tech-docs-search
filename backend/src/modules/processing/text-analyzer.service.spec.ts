import { TextAnalyzerService } from './text-analyzer.service';

describe('TextAnalyzerService', () => {
  const analyzer = new TextAnalyzerService();

  it('extrae palabras clave por frecuencia ignorando stopwords, números y términos cortos', () => {
    const text = 'Kubernetes orquesta contenedores. Kubernetes escala contenedores de la API en 2024. Kubernetes es clave.';
    const { keywords } = analyzer.analyze(text);

    expect(keywords[0]).toBe('kubernetes');
    expect(keywords[1]).toBe('contenedores');
    expect(keywords).not.toContain('de');
    expect(keywords).not.toContain('la');
    expect(keywords).not.toContain('2024');
  });

  it('respeta el número máximo de palabras clave', () => {
    const text = 'alfa beta gamma delta epsilon zeta theta iota kappa lambda omicron sigma';
    expect(analyzer.analyze(text, { maxKeywords: 3 }).keywords).toHaveLength(3);
  });

  it('genera un resumen extractivo conservando el orden original de las oraciones', () => {
    const text = [
      'Introducción general sin mucha relevancia para el tema.',
      'Docker empaqueta aplicaciones en contenedores Docker portables.',
      'Esta oración habla de otra cosa completamente distinta.',
      'Kubernetes orquesta contenedores Docker en clústeres de producción.',
    ].join(' ');

    const { summary } = analyzer.analyze(text, { maxSentences: 2 });

    expect(summary.indexOf('Docker empaqueta')).toBeGreaterThanOrEqual(0);
    expect(summary.indexOf('Kubernetes orquesta')).toBeGreaterThan(summary.indexOf('Docker empaqueta'));
  });

  it('trunca el resumen con elipsis al superar el máximo', () => {
    const sentence = 'Arquitectura hexagonal con puertos y adaptadores para servicios.';
    const { summary } = analyzer.analyze(sentence.repeat(20), { maxSummaryLength: 50, maxSentences: 5 });

    expect(summary.length).toBeLessThanOrEqual(50);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('elimina símbolos de markdown antes de analizar', () => {
    const { summary } = analyzer.analyze('# Título del manual de despliegue en producción\n\n**Docker** y `Kubernetes` en producción.');
    expect(summary).not.toMatch(/[#*`]/);
  });
});
