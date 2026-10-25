import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminDevicesQueryDto, AdminHistoryQueryDto } from './dto/admin-devices-query.dto';

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

  @Get('devices/:deviceId/locations/history')
  getDeviceHistory(
    @Param('deviceId') deviceId: string,
    @Query() query: AdminHistoryQueryDto,
  ) {
    return this.adminService.getDeviceHistory(deviceId, query);
  }
}
