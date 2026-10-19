import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NumberSequence } from './number-sequence.entity';
import { NumberSequenceService } from './number-sequence.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NumberSequence])],
  providers: [NumberSequenceService],
  exports: [NumberSequenceService],
})
export class SequencesModule {}
