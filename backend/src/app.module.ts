import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { bullRootModule } from './config/bull.config';
import { dataSourceOptions } from './config/data-source';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    bullRootModule,
    DocumentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
