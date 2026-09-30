# Tech Docs Search

Buscador y visor de documentos técnicos: carga individual o masiva (PDF, TXT, Markdown), procesamiento asíncrono, búsqueda full-text en PostgreSQL y notificaciones en tiempo real vía SSE.

**Stack:** NestJS 12 · Angular 22 · PostgreSQL 17 (tsvector + GIN) · Redis 7 + BullMQ · Docker

[Arquitectura](docs/architecture.md) · [Uso de IA](docs/ia.md)

## Ejecución con Docker (recomendada)

Solo requiere **Docker** y **Git**.

```bash
git clone https://github.com/JohnAlexMontoya/tech-docs-search.git
cd tech-docs-search
cp .env.example .env
docker compose up -d --build
```

| Servicio | URL |
|---|---|
| Aplicación web | http://localhost:8080 |
| API | http://localhost:3000/api |
| Estado del sistema | http://localhost:3000/api/health |

El compose levanta PostgreSQL, Redis, las migraciones, la API, el worker y el frontend (nginx). Para escalar el procesamiento: `docker compose up -d --scale worker=3`.

> Requiere los puertos 5432, 6379, 3000 y 8080 libres. Si alguno está ocupado, ajústalo en `.env`.

## Ejecución local (desarrollo)

Requiere además **Node.js 24** y **pnpm** (`corepack enable pnpm`).

```bash
pnpm install
cp backend/.env.example backend/.env
docker compose up -d postgres redis
pnpm --filter backend migration:run
```

En tres terminales:

```bash
pnpm --filter backend start:dev          # API    → http://localhost:3000/api
pnpm --filter backend start:worker:dev   # Worker de procesamiento
pnpm --filter frontend start             # Web    → http://localhost:4200
```

Datos de volumen y benchmark (opcional):

```bash
pnpm --filter backend seed 10000       # 10.000 documentos indexados
pnpm --filter backend benchmark 200    # latencia de búsqueda p50/p95/p99
```

## Pruebas

```bash
pnpm --filter backend test        # unitarias
pnpm --filter backend test:cov    # unitarias con cobertura

# integración (PostgreSQL y Redis reales; crear la BD solo la primera vez)
docker compose exec postgres psql -U docs -d docs -c "CREATE DATABASE docs_test;"
pnpm --filter backend test:e2e
```

## API

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/documents` | Carga individual (`multipart`): `file`, `title`, `author`, `category`, `version`, `tags`. Responde `202` con ID y estado `PROCESANDO` |
| `POST` | `/api/documents/batch` | Carga masiva (hasta 20 archivos en `files`) |
| `GET` | `/api/search?q=` | Búsqueda full-text con paginación (`page`, `pageSize`), filtros (`category`, `tags`) y resaltado |
| `GET` | `/api/documents/:id` | Detalle: metadatos, resumen, palabras clave y contenido |
| `GET` | `/api/events/documents` | Stream SSE de cambios de estado (`INDEXADO` / `ERROR`) |
| `GET` | `/api/health` | Estado de PostgreSQL y Redis |

Formatos permitidos: PDF, TXT y MD, con un máximo de 20 MB por archivo. Los errores responden con un formato uniforme (`statusCode`, `message`, `path`, `timestamp`).

## Estructura

```
├── backend/           # NestJS: API y worker (mismo código, dos procesos)
├── frontend/          # Angular: búsqueda, carga con estado en vivo y visor
├── packages/shared/   # Tipos compartidos entre backend y frontend
├── docs/              # architecture.md e ia.md
└── docker-compose.yml
```
