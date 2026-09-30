import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'ioredis';

export const redisOptions = (config: ConfigService): RedisOptions => ({
  host: config.get<string>('REDIS_HOST', 'localhost'),
  port: Number(config.get('REDIS_PORT', 6379)),
  db: Number(config.get('REDIS_DB', 0)),
});
