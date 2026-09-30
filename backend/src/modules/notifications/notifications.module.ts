import { Module } from '@nestjs/common';
import { DocumentEventsSubscriber } from './document-events.subscriber';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [DocumentEventsSubscriber],
})
export class NotificationsModule {}
