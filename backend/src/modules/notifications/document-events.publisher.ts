import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentStatusEvent } from '@tech-docs/shared';
import { Redis } from 'ioredis';
import { redisOptions } from '../../config/redis.config';

export const DOCUMENT_EVENTS_CHANNEL = 'documents:status';

/**
 * Publica cambios de estado en Redis Pub/Sub.
 * Desacopla el worker de la API: cualquier réplica de la API puede reenviarlos por SSE.
 */
@Injectable()
export class DocumentEventsPublisher implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
    this.redis = new Redis(redisOptions(config));
  }

  async publish(event: DocumentStatusEvent): Promise<void> {
    await this.redis.publish(DOCUMENT_EVENTS_CHANNEL, JSON.stringify(event));
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
