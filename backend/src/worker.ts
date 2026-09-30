import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/** Proceso independiente de la API: consume la cola y escala horizontalmente por separado. */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks(); // termina los jobs en curso antes de apagarse
  new Logger('Worker').log(`Worker iniciado (concurrencia ${process.env.WORKER_CONCURRENCY ?? 4})`);
}

void bootstrap();
