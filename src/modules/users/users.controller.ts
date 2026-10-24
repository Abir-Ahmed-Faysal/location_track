import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteUserDto } from './dto/delete-user.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    id?: string;
    email?: string;
  };
}

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return this.usersService.getProfile(user.id);
  }

  @Patch('me')
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return this.usersService.updateProfile(user.id, dto);
  }

  @Patch('change-password')
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return this.usersService.changePassword(user.id, dto);
  }

  @Delete('me')
  deleteUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeleteUserDto,
  ) {
    const user = req.user;
    if (!user?.id) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return this.usersService.deleteUser(user.id, dto);
  }
}
