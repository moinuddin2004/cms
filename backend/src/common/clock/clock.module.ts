import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from 'src/locations/entities/location.entity';
import { ClockService } from './clock.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Location])],
  providers: [ClockService],
  exports: [ClockService],
})
export class ClockModule {}
