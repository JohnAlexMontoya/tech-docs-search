import { Controller, Get, Query } from '@nestjs/common';
import type { PaginatedResponse, SearchHitDto } from '@tech-docs/shared';
import { SearchDocumentsDto } from './dto/search-documents.dto';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** HU-02: búsqueda full-text con ranking, filtros, paginación y resaltado. */
  @Get()
  search(@Query() dto: SearchDocumentsDto): Promise<PaginatedResponse<SearchHitDto>> {
    return this.searchService.search(dto);
  }
}
