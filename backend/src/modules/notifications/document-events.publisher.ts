import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentStatusEvent } from '@tech-docs/shared';
import { Redis } from 'ioredis';

export const DOCUMENT_EVENTS_CHANNEL = 'documents:status';

/**
 * Publica cambios de estado en Redis Pub/Sub.
 * Desacopla el worker de la API: cualquier réplica de la API puede reenviarlos por SSE.
 */
@Injectable()
export class DocumentEventsPublisher implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis({
      host: config.get<string>('REDIS_HOST', 'localhost'),
      port: Number(config.get('REDIS_PORT', 6379)),
    });
  }

  async publish(event: DocumentStatusEvent): Promise<void> {
    await this.redis.publish(DOCUMENT_EVENTS_CHANNEL, JSON.stringify(event));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
