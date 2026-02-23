import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionService } from './session.service';
import { UserSession } from './entities/user-session.entity';

@Module({
    imports: [TypeOrmModule.forFeature([UserSession])],
    providers: [SessionService],
    exports: [SessionService, TypeOrmModule],
})
export class SessionModule { }
