import { Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { LabActor, LabPortalController } from 'src/labs/portal/lab-actor';
import type { LabActorContext } from 'src/labs/portal/lab-portal.constants';
import {
  BillsQueryDto,
  PaymentsQueryDto,
  StatementsQueryDto,
} from '../dto/payables.dto';
import { LabPortalPayablesService } from '../services/lab-portal-payables.service';

/**
 * Lab portal: the bills clinics approved for this lab, their payments and
 * statements — read-only, scoped to the member's lab by `LabPortalGuard`.
 */
@LabPortalController('payables')
export class LabPortalPayablesController {
  constructor(private readonly payables: LabPortalPayablesService) {}

  @Get('bills')
  async bills(@LabActor() lab: LabActorContext, @Query() q: BillsQueryDto) {
    return ResponseWrapper.success(await this.payables.bills(lab, q));
  }

  @Get('bills/:id')
  async bill(
    @LabActor() lab: LabActorContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.payables.bill(lab, id));
  }

  @Get('payments')
  async payments(
    @LabActor() lab: LabActorContext,
    @Query() q: PaymentsQueryDto,
  ) {
    return ResponseWrapper.success(await this.payables.payments(lab, q));
  }

  @Get('statements')
  async statements(
    @LabActor() lab: LabActorContext,
    @Query() q: StatementsQueryDto,
  ) {
    return ResponseWrapper.success(await this.payables.statements(lab, q));
  }

  @Get('statements/:id')
  async statement(
    @LabActor() lab: LabActorContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.payables.statement(lab, id));
  }
}
