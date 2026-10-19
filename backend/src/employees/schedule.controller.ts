import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  ParseUUIDPipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { SetScheduleDto } from './dto/schedule/set-schedule.dto';
import { ScheduleDayDto } from './dto/schedule/schedule-day.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AppRole } from 'src/common/enums/app-role.enum';

@Controller('employees/:employeeId/schedule')
@Roles(AppRole.CLINIC_ADMIN)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async setSchedule(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SetScheduleDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.scheduleService.setSchedule(
      employeeId,
      dto,
      ctx,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Schedule saved successfully');
  }

  @Get()
  async getSchedule(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.scheduleService.getSchedule(employeeId, ctx);
    return ResponseWrapper.success(data, 'Schedule retrieved successfully');
  }

  @Patch(':dayOfWeek')
  async updateDay(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Body() dto: ScheduleDayDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.scheduleService.updateDay(
      employeeId,
      dayOfWeek,
      dto,
      ctx,
      req.user?.uuid,
    );
    return ResponseWrapper.success(data, 'Schedule day updated successfully');
  }
}
