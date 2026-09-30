import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentStatusEvent } from '@tech-docs/shared';
import { Redis } from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { redisOptions } from '../../config/redis.config';
import { DOCUMENT_EVENTS_CHANNEL } from './document-events.publisher';

/**
 * Observer: escucha Redis Pub/Sub y expone los eventos como un stream RxJS.
 * Una sola suscripción a Redis por réplica, sin importar cuántos clientes SSE haya.
 */
@Injectable()
export class DocumentEventsSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentEventsSubscriber.name);
  private readonly redis: Redis;
  private readonly subject = new Subject<DocumentStatusEvent>();
  readonly events$: Observable<DocumentStatusEvent> = this.subject.asObservable();

  constructor(config: ConfigService) {
    // Una conexión en modo subscribe no puede ejecutar otros comandos: se usa una dedicada
    this.redis = new Redis(redisOptions(config));
  }

  async onModuleInit(): Promise<void> {
    this.redis.on('message', (channel: string, message: string) => {
      if (channel !== DOCUMENT_EVENTS_CHANNEL) return;
      try {
        this.subject.next(JSON.parse(message) as DocumentStatusEvent);
      } catch {
        this.logger.warn(`Evento inválido descartado: ${message}`);
      }
    });
    await this.redis.subscribe(DOCUMENT_EVENTS_CHANNEL);
    this.logger.log(`Suscrito al canal ${DOCUMENT_EVENTS_CHANNEL}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.subject.complete();
    await this.redis.quit();
  }
}
