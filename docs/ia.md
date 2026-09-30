# Uso de Inteligencia Artificial

## 1. Herramientas utilizadas

| Herramienta | Uso |
|---|---|
| Claude (Anthropic) | Asistente durante el desarrollo: generación de código, contraste de alternativas técnicas, diagnóstico de errores y apoyo en la documentación |

## 2. Rol de la IA y decisiones técnicas propias

La IA se utilizó para **agilizar la codificación mecánica** (boilerplate, configuración, pruebas repetitivas) y como **apoyo para contrastar alternativas**. La definición del problema, las decisiones técnicas y la validación de cada resultado fueron propias.

### Decisiones técnicas

| Decisión | Motivo |
|---|---|
| **NestJS + Angular sobre TypeScript** | Un solo lenguaje en todo el sistema permite compartir tipos y DTOs (`packages/shared`) y agiliza el desarrollo. NestJS aporta de forma nativa inyección de dependencias, validación, filtros de excepciones y SSE, e integración oficial con colas (`@nestjs/bullmq`) |
| **PostgreSQL con Full-Text Search** | Motor de búsqueda nativo e indexado (`tsvector` + GIN) que cumple la restricción de no usar `LIKE`, permite consultas relacionales complejas con `JOIN` en la misma búsqueda y evita operar y sincronizar un servicio adicional como Elasticsearch |
| **Procesamiento asíncrono con cola y worker separado** | La carga responde de inmediato y el procesamiento pesado ocurre en segundo plano, con reintentos, idempotencia y escalado independiente |
| **SSE con Redis Pub/Sub** | La comunicación es solo del servidor al cliente; SSE es más simple que WebSocket, funciona sobre HTTP estándar y escala a varias instancias gracias a Pub/Sub |
| **Monolito modular** | Arquitectura suficiente para el alcance, con módulos bien delimitados; se descartaron microservicios y hexagonal completa por ser sobre-ingeniería para este alcance |
| **Principios SOLID y patrones puntuales** | Código limpio, mantenible y extensible. Los patrones (Strategy, puerto/adaptador, Observer) se aplicaron solo donde resuelven un problema concreto |
| **Pruebas unitarias y de integración** | Asegurar el comportamiento de los componentes críticos (carga, procesamiento, búsqueda, concurrencia) y validar el flujo completo contra PostgreSQL y Redis reales |
| **Contenerización completa con Docker** | Ejecutar todo el sistema con un solo comando, eliminar el problema de "en mi máquina funciona", seguir un estándar de despliegue y facilitar el escalado (`--scale worker=N`) |
| **Monorepo y commits progresivos** | Backend, frontend y tipos compartidos en un solo repositorio, con un historial que refleja la evolución del desarrollo |

### Criterios aplicados

- Cada componente debía poder **justificarse técnicamente** frente al problema; lo que no cumplía ese criterio se descartó (GraphQL, CQRS, microservicios, un LLM para resúmenes).
- Se priorizó lo **obligatorio** del enunciado y lo que aporta valor real frente a lo accesorio.
- Todo resultado se validó con **evidencia medible** antes de incorporarlo.

## 3. Casos de uso

| Etapa | Uso de la IA |
|---|---|
| Boilerplate | Scaffolding de módulos NestJS, entidades, DTOs, componentes Angular y archivos de Docker |
| Base de datos | Borrador del esquema, la migración y la consulta de búsqueda, revisados y ajustados |
| Procesamiento | Implementación del worker, los extractores por formato y el análisis de texto |
| Tiempo real | Integración SSE + Redis Pub/Sub en backend y frontend |
| Pruebas | Generación de casos a partir de los escenarios definidos (errores, duplicados, concurrencia, flujo completo) |
| Errores | Diagnóstico de incompatibilidades entre versiones recientes de librerías |
| Documentación | Borradores ajustados posteriormente |

## 4. Prompts clave

Ejemplos representativos y cómo se refinaron:

1. **Contexto antes que código.** El planteamiento inicial, solo con el enunciado, produjo una propuesta genérica. Se refinó con las prioridades del requerimiento y los criterios propios (SQL, asincronía, tiempos de respuesta, escalabilidad y mantenibilidad). Resultado: resumen y palabras clave automáticas, modelo normalizado para búsquedas con `JOIN` y una arquitectura más simple.
2. **Justificación por componente.** *"Listar cada componente del stack con su propósito, su alternativa y su justificación técnica."* Sirvió para confirmar o descartar piezas según los criterios definidos (como evitar el uso de motores como Elasticsearch, ya que PostgreSQL Full-Text Search lo cubre).
3. **Cuestionar lo generado.** Por ejemplo: *"¿Es habitual escribir la migración a mano en TypeORM?"* Se confirmó el flujo code-first estándar y se mantuvo el SQL explícito para el índice GIN. También se comparó este enfoque respecto al enfoque database-first y scaffold.
4. **Diagnóstico con evidencia.** Ante cada error se compartió la salida completa de la terminal, lo que redujo los intentos fallidos.
5. **Verificación contra el enunciado.** *"¿Este componente es obligatorio o deseable?"* Sirvió para ordenar las prioridades de la entrega.

## 5. Validación humana

Todo bloque generado se ejecutó y verificó antes de hacer commit:

- **Endpoints:** probados con `curl`, incluidos los casos de error (400, 409, 415).
- **Esquema:** revisado en PostgreSQL (tablas, índices, consultas con `JOIN`).
- **Rendimiento:** medido con benchmark y `EXPLAIN ANALYZE`.
- **Tiempo real:** stream SSE observado con `curl -N` y probado en la interfaz, incluida la reconexión.
- **Pruebas:** suites unitarias (25) y de integración (7) ejecutadas antes de cada commit.
- **Docker:** entorno completo levantado en un equipo limpio, sin Node instalado.

### Correcciones realizadas

| Problema | Cómo se detectó | Corrección |
|---|---|---|
| El seed inicial generaba datos poco realistas (términos en el 98 % de los documentos); la búsqueda no usaba el índice y tardaba ~600 ms | `EXPLAIN ANALYZE` y benchmark | Seed con vocabulario acotado por documento: índice GIN en uso y p50 de 37 ms. El peor caso se conservó como evidencia |
| Una prueba e2e de XSS partía de una premisa falsa (`ts_headline` ya elimina etiquetas HTML) | Falló al ejecutarla | Se reescribió para verificar que el único HTML en el resaltado sea `<mark>` |
| El resumen incluía símbolos de Markdown (`#`) | Revisión de datos en la base | Limpieza de Markdown antes del análisis |
| Cambios de API en BullMQ 6 (`ioredis` opcional, tipo de conexión, `Queue.client` eliminado) | Errores de compilación y ejecución | Ajuste de la configuración y del health check |
| NestJS 12 se publica como ESM y la configuración e2e de Jest no transformaba TypeScript | Falló la suite e2e | Reutilizar la configuración de Jest del proyecto |
| El paquete compartido no resolvía los tipos y faltaban los tipos de Multer | Errores de compilación | Campo `exports` en `packages/shared` y ajuste del `tsconfig` |
| Posible carrera: un documento pequeño se indexa antes de que llegue la respuesta del upload | Análisis del flujo | El frontend conserva los últimos eventos SSE y los aplica al recibir la respuesta |
| PostgreSQL y Redis no se reiniciaban tras reiniciar el equipo | Prueba en un equipo limpio | Política `restart: unless-stopped` en todos los servicios |

## 6. Conclusión

La IA redujo el tiempo en tareas repetitivas y en la resolución de incompatibilidades entre versiones. Las decisiones de stack, arquitectura, calidad (SOLID, patrones y pruebas) y despliegue (Docker) se tomaron con criterio propio, y cada resultado se validó con evidencia medible.
