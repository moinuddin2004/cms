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
import { Can } from 'src/access/decorators/access.decorators';

@Controller('employees/:employeeId/schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post()
  @Can('employees.manage')
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
  @Can('employees.view')
  async getSchedule(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.scheduleService.getSchedule(employeeId, ctx);
    return ResponseWrapper.success(data, 'Schedule retrieved successfully');
  }

  @Patch(':dayOfWeek')
  @Can('employees.manage')
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
