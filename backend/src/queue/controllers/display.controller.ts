import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Public } from 'src/common/decorators/publicDecorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { QueueQueryService } from '../services/queue-query.service';

/**
 * TV display state for a location: per doctor, the token being served and
 * the next few tokens. No patient names or phones — ever — so the screen in
 * the waiting room needs no login. Live updates: subscribe to
 * `location:<id>:display` on the `/realtime` socket.
 */
@Public()
@Controller('queue/displays')
export class DisplayController {
  constructor(private readonly query: QueueQueryService) {}

  @Get(':locationId/state')
  async state(@Param('locationId', ParseUUIDPipe) locationId: string) {
    return ResponseWrapper.success(
      await this.query.displayState(locationId),
      'Display state',
    );
  }
}
