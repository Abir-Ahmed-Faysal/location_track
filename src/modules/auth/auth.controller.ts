import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Headers,
  UnauthorizedException,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/singup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthGuard } from './guards/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.login(dto, userAgent, req.ip);
    this.setAuthCookies(res, result);
    return result;
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Headers('user-agent') userAgent?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.refresh(dto, userAgent, req.ip);
    this.setAuthCookies(res, result);
    return result;
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(
    @Body('refreshToken') refreshToken?: string,
    @Req() req?: Request & { user?: { id?: string; email?: string } },
    @Res({ passthrough: true }) res?: Response,
  ) {
    const userId = req?.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const result = await this.authService.logout(userId, refreshToken);
    this.clearAuthCookies(res);
    return result;
  }

  @Post('logout-all')
  @UseGuards(AuthGuard)
  async logoutAll(
    @Req() req: Request & { user?: { id?: string; email?: string } },
    @Res({ passthrough: true }) res?: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    const result = await this.authService.logoutAll(userId);
    this.clearAuthCookies(res);
    return result;
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  profile(@Req() req: Request & { user?: { id?: string; email?: string } }) {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.authService.profile(userId);
  }

  private setAuthCookies(response: Response | undefined, tokens: { accessToken: string; refreshToken: string }) {
    if (!response) {
      return;
    }

    response.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    response.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
  }

  private clearAuthCookies(response: Response | undefined) {
    if (!response) {
      return;
    }

    response.clearCookie('access_token', { path: '/' });
    response.clearCookie('refresh_token', { path: '/' });
  }
}
