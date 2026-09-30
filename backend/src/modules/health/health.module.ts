import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DOCUMENT_QUEUE } from '../processing/processing.constants';
import { HealthController } from './health.controller';

@Module({
  imports: [BullModule.registerQueue({ name: DOCUMENT_QUEUE })],
  controllers: [HealthController],
})
export class HealthModule {}
