import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import {
  UpdateLeaveDto,
  ReviewLeaveDto,
  LeaveFilterDto,
} from './dto/update-leave.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@Controller('leaves')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateLeaveDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.leaveService.create(dto, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Leave request created successfully');
  }

  @Get()
  async findAll(
    @Query() filters: LeaveFilterDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.leaveService.findAll(filters, ctx);
    return ResponseWrapper.success(data, 'Leave requests retrieved successfully');
  }

  @Get('balance/:employeeId')
  async getBalance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.leaveService.getBalance(employeeId, ctx);
    return ResponseWrapper.success(data, 'Leave balance retrieved successfully');
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.leaveService.findOne(id, ctx);
    return ResponseWrapper.success(data, 'Leave request retrieved successfully');
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaveDto,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.leaveService.update(id, dto, ctx);
    return ResponseWrapper.success(data, 'Leave request updated successfully');
  }

  @Patch(':id/approve')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLeaveDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.leaveService.approve(id, dto, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Leave request approved');
  }

  @Patch(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLeaveDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.leaveService.reject(id, dto, ctx, req.user?.uuid);
    return ResponseWrapper.success(data, 'Leave request rejected');
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @ActiveTenant() ctx: TenantContext,
  ) {
    const data = await this.leaveService.cancel(id, ctx);
    return ResponseWrapper.success(data, 'Leave request cancelled');
  }
}
