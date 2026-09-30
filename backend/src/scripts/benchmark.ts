/**
 * Benchmark de búsqueda end-to-end (HTTP) contra la API en ejecución.
 * Uso: pnpm --filter backend benchmark 200
 */
const BASE_URL = process.env.API_URL ?? 'http://localhost:3000/api';
const RUNS = Number(process.argv[2] ?? 100);
const QUERIES = [
  'kubernetes', 'arquitectura hexagonal', 'seguridad oauth', '"base de datos"', 'docker -azure',
  'cache redis', 'microservicios api', 'despliegue continuo', 'rendimiento consultas', 'angular componentes',
];

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
};

async function searchOnce(q: string, page: number): Promise<{ client: number; server: number; total: number }> {
  const started = performance.now();
  const response = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}&page=${page}&pageSize=10`);
  if (!response.ok) throw new Error(`HTTP ${response.status} para "${q}"`);
  const body = (await response.json()) as { tookMs: number; total: number };
  return { client: performance.now() - started, server: body.tookMs, total: body.total };
}

async function main(): Promise<void> {
  for (const q of QUERIES) await searchOnce(q, 1); // calentamiento

  const client: number[] = [];
  const server: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const result = await searchOnce(QUERIES[i % QUERIES.length], 1 + (i % 3));
    client.push(result.client);
    server.push(result.server);
  }

  const stats = (v: number[]) => ({ p50: percentile(v, 50), p95: percentile(v, 95), p99: percentile(v, 99), max: percentile(v, 100) });
  console.log(`\n${RUNS} búsquedas — latencia en ms`);
  console.table({ 'Cliente (HTTP)': stats(client), 'Servidor (consulta)': stats(server) });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
