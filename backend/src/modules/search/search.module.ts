import { Module } from '@nestjs/common';
import { PostgresSearchEngine } from './postgres-search.engine';
import { SEARCH_ENGINE } from './search-engine.port';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [
    SearchService,
    PostgresSearchEngine,
    { provide: SEARCH_ENGINE, useExisting: PostgresSearchEngine },
  ],
})
export class SearchModule {}
