import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { redisOptions } from './redis.config';

export const bullRootModule = BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const { host, port, db } = redisOptions(config);
    return {
      connection: { host, port, db },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    };
  },
});
