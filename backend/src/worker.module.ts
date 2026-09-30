import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { bullRootModule } from './config/bull.config';
import { dataSourceOptions } from './config/data-source';
import { ProcessingModule } from './modules/processing/processing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(dataSourceOptions),
    bullRootModule,
    ProcessingModule,
  ],
})
export class WorkerModule {}
