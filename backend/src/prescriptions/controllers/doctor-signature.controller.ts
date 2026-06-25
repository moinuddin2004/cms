import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { DoctorSignatureService } from '../services/doctor-signature.service';
import { SaveDoctorSignatureDto } from '../dto/doctor-signature.dto';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import { ActiveTenant } from 'src/common/decorators/active-tenant.decorator';
import { RequireFeature } from 'src/common/decorators/require-feature.decorator';
import { TenantContext } from 'src/common/middleware/tenant-context.middleware';

@RequireFeature('patients.prescriptions')
@Controller('doctor-signatures')
export class DoctorSignatureController {
  constructor(
    private readonly service: DoctorSignatureService,
  ) {}

  /** Save / update the current user's signature. */
  @Post()
  @HttpCode(HttpStatus.OK)
  async saveMine(
    @Body() dto: SaveDoctorSignatureDto,
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.save(req.user.uuid, ctx.organizationId, dto);
    return ResponseWrapper.success(data, 'Signature saved');
  }

  @Get('my')
  async getMine(@Req() req: any) {
    const data = await this.service.getByEmployee(req.user.uuid);
    return ResponseWrapper.success(data);
  }

  @Get('doctor/:employeeId')
  async getByEmployee(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    const data = await this.service.getByEmployee(employeeId);
    return ResponseWrapper.success(data);
  }

  @Delete()
  async deleteMine(
    @ActiveTenant() ctx: TenantContext,
    @Req() req: any,
  ) {
    const data = await this.service.deleteByEmployee(
      req.user.uuid,
      ctx.organizationId,
    );
    return ResponseWrapper.success(data, 'Signature deleted');
  }
}
