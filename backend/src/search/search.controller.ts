import { Controller, Get, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { Access, AnyMember } from 'src/access/decorators/access.decorators';
import type { AccessContext } from 'src/access/access-context';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search-query.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Global quick search. Any member may call it; each result type is
   * filtered by its own view permission + scope inside the service.
   */
  @Get()
  @AnyMember()
  async search(@Query() query: SearchQueryDto, @Access() access: AccessContext) {
    const data = await this.searchService.search(
      access,
      query.q,
      query.types,
      query.limit,
    );
    return ResponseWrapper.success(data, 'Search results');
  }
}
