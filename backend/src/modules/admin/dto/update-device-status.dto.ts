import { IsIn } from 'class-validator';

export class UpdateDeviceStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
