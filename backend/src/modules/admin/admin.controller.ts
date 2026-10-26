import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminDevicesQueryDto, AdminHistoryQueryDto } from './dto/admin-devices-query.dto';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto';

/** Read-only endpoints for explicitly provisioned administrators. */
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('overview')
  overview() {
    return this.adminService.overview();
  }

  @Get('devices')
  listDevices(@Query() query: AdminDevicesQueryDto) {
    return this.adminService.listDevices(query);
  }

  @Get('devices/:deviceId')
  getDevice(@Param('deviceId') deviceId: string) {
    return this.adminService.getDevice(deviceId);
  }

  @Patch('devices/:deviceId/status')
  updateDeviceStatus(@Param('deviceId') deviceId: string, @Body() input: UpdateDeviceStatusDto) {
    return this.adminService.updateDeviceStatus(deviceId, input.status);
  }

  @Get('devices/:deviceId/locations/history')
  getDeviceHistory(
    @Param('deviceId') deviceId: string,
    @Query() query: AdminHistoryQueryDto,
  ) {
    return this.adminService.getDeviceHistory(deviceId, query);
  }
}
