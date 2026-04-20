import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  Req,
  Query,
  Headers,
  BadRequestException,
  Body,
  Param,
} from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from './entities/user.entity';
import { AuthTokenDto } from '../auth/dto/response/auth.token.dto';
import { TokensDto } from '../auth/dto/response/token.dto';
import { UserDto } from './dto/user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Req() req): Promise<UserDto> {
    return UserDto.toDto(req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getUsers(
    @Req() req,
    @Query('type') type: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Headers('x-organization-id') orgId: string,
  ) {
    if (!['super_admin', 'owner', 'employee'].includes(type) && type) {
      throw new BadRequestException('Invalid user type');
    }
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;

    return this.userService.findUsers(
      req.user,
      (type || 'employee') as 'super_admin' | 'owner' | 'employee',
      pageNumber,
      limitNumber,
      orgId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createUser(
    @Req() req,
    @Body() body: any,
    @Headers('x-organization-id') orgId: string,
  ) {
    return this.userService.createUser(req.user, body, orgId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  async updateUser(
    @Req() req,
    @Param('id') targetUserId: string,
    @Body() body: any,
    @Headers('x-organization-id') orgId: string,
  ) {
    return this.userService.updateUser(req.user, targetUserId, body, orgId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteUser(
    @Req() req,
    @Param('id') targetUserId: string,
    @Headers('x-organization-id') orgId: string,
  ) {
    return this.userService.deleteUser(req.user, targetUserId, orgId);
  }
}
