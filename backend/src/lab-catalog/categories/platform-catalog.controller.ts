import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ActorRef, ActorSide } from 'src/common/audit/audit.enums';
import { RequestActor } from 'src/common/audit/request-actor.decorator';
import { RequireSuperAdmin } from 'src/common/decorators/require-super-admin.decorator';
import { ResponseWrapper } from 'src/common/dtos/ResponseWrapper';
import {
  CreateCategoryDto,
  CreateLabServiceDto,
  CreateOptionDto,
  CreatePriceDto,
  ListCategoriesQueryDto,
  ListLabServicesQueryDto,
  ListPricesQueryDto,
  UpdateCategoryDto,
  UpdateLabServiceDto,
  UpdateOptionDto,
  UpdatePriceDto,
  VoidPriceDto,
} from '../dto/catalog.dto';
import { LabServicePricesService } from '../services/lab-service-prices.service';
import { LabServicesService } from '../services/lab-services.service';
import { ServiceCategoriesService } from './service-categories.service';

/** Platform service categories — super admins only. */
@Controller('platform/service-categories')
@RequireSuperAdmin()
export class PlatformServiceCategoriesController {
  constructor(private readonly categories: ServiceCategoriesService) {}

  @Get()
  async list(@Query() q: ListCategoriesQueryDto) {
    return ResponseWrapper.success(await this.categories.list(q));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateCategoryDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.categories.create(dto, actor),
      'Category created',
    );
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.categories.update(id, dto, actor),
      'Category updated',
    );
  }
}

/**
 * A lab's services, options and prices — super admins for now. The lab
 * portal will add its own route group calling the same services with the
 * member's lab id.
 */
@Controller('platform/labs/:labId/services')
@RequireSuperAdmin()
export class PlatformLabServicesController {
  constructor(
    private readonly services: LabServicesService,
    private readonly prices: LabServicePricesService,
  ) {}

  @Get()
  async list(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Query() q: ListLabServicesQueryDto,
  ) {
    return ResponseWrapper.success(await this.services.list(labId, q));
  }

  @Get(':id')
  async get(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.services.get(labId, id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Body() dto: CreateLabServiceDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.services.create(labId, dto, actor),
      'Service added',
    );
  }

  @Patch(':id')
  async update(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLabServiceDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.services.update(labId, id, dto, actor),
      'Service updated',
    );
  }

  @Get(':id/history')
  async history(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return ResponseWrapper.success(await this.services.history(labId, id));
  }

  @Post(':id/options')
  @HttpCode(HttpStatus.CREATED)
  async addOption(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOptionDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.services.addOption(labId, id, dto, actor),
      'Option added',
    );
  }

  @Patch(':id/options/:optionId')
  async updateOption(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() dto: UpdateOptionDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.services.updateOption(labId, id, optionId, dto, actor),
      'Option updated',
    );
  }

  @Get(':id/prices')
  async listPrices(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ListPricesQueryDto,
  ) {
    return ResponseWrapper.success(await this.prices.list(labId, id, q));
  }

  @Post(':id/prices')
  @HttpCode(HttpStatus.CREATED)
  async addPrice(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePriceDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.prices.create(labId, id, dto, actor),
      'Price saved',
    );
  }

  @Patch(':id/prices/:priceId')
  async updatePrice(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('priceId', ParseUUIDPipe) priceId: string,
    @Body() dto: UpdatePriceDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.prices.update(labId, id, priceId, dto, actor),
      'Price updated',
    );
  }

  @Post(':id/prices/:priceId/void')
  async voidPrice(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('priceId', ParseUUIDPipe) priceId: string,
    @Body() dto: VoidPriceDto,
    @RequestActor(ActorSide.PLATFORM) actor: ActorRef,
  ) {
    return ResponseWrapper.success(
      await this.prices.void(labId, id, priceId, dto, actor),
      'Price voided',
    );
  }

  @Get(':id/prices/:priceId/history')
  async priceHistory(
    @Param('labId', ParseUUIDPipe) labId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('priceId', ParseUUIDPipe) priceId: string,
  ) {
    return ResponseWrapper.success(
      await this.prices.history(labId, id, priceId),
    );
  }
}
