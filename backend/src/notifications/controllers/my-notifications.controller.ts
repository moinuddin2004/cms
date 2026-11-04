import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ContextFree } from 'src/common/decorators/context-free.decorator';
import { CurrentUserId } from 'src/common/decorators/current-user.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  MyNotificationsQueryDto,
  UpdateMyNotificationPrefsDto,
} from '../dto/notifications.dto';
import { UserNotificationsService } from '../services/user-notifications.service';

/**
 * The signed-in user's in-app notifications. Context-free: lab users have
 * no clinic location, and a user's inbox spans every clinic they work at.
 */
@Controller('me/notifications')
@ContextFree()
export class MyNotificationsController {
  constructor(private readonly inbox: UserNotificationsService) {}

  @Get()
  async list(
    @CurrentUserId() userId: string | undefined,
    @Query() q: MyNotificationsQueryDto,
  ) {
    return ResponseWrapper.success(await this.inbox.list(must(userId), q));
  }

  /** Personal switches (notification sound). */
  @Get('prefs')
  async prefs(@CurrentUserId() userId: string | undefined) {
    return ResponseWrapper.success(await this.inbox.getPrefs(must(userId)));
  }

  @Put('prefs')
  async updatePrefs(
    @CurrentUserId() userId: string | undefined,
    @Body() dto: UpdateMyNotificationPrefsDto,
  ) {
    return ResponseWrapper.success(
      await this.inbox.updatePrefs(must(userId), dto),
      'Notification settings saved',
    );
  }

  @Get('unread-count')
  async unreadCount(@CurrentUserId() userId: string | undefined) {
    return ResponseWrapper.success(await this.inbox.unreadCount(must(userId)));
  }

  /** Declared before `:id/read`. */
  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  async markAllRead(@CurrentUserId() userId: string | undefined) {
    return ResponseWrapper.success(await this.inbox.markAllRead(must(userId)));
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(
    @CurrentUserId() userId: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.inbox.markRead(must(userId), id));
  }
}

function must(userId: string | undefined): string {
  if (!userId) throw new UnauthorizedException();
  return userId;
}
