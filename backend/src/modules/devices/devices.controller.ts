import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/guards/auth.guard';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

/** Device enrollment endpoints. */
@Controller('devices')
@UseGuards(AuthGuard)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  /** Registers a device for the authenticated integration. */
  @Post('register')
  register(
    @Body() input: RegisterDeviceDto,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.devicesService.register(input, request.user?.id as string);
  }

  /** Gets a registered active device by its internal UUID. */
  @Get(':id')
  findById(
    @Param('id') id: string,
    @Req() request: Request & { user?: { id?: string } },
  ) {
    return this.devicesService.findById(id, request.user?.id as string);
  }
}
