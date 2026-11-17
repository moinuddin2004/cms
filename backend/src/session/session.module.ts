import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { UserSession } from './entities/user-session.entity';
import { StaffSessionEvents } from './session-events';

@Module({
  imports: [TypeOrmModule.forFeature([UserSession])],
  providers: [SessionService, StaffSessionEvents],
  exports: [SessionService, StaffSessionEvents, TypeOrmModule],
})
export class SessionModule {}
