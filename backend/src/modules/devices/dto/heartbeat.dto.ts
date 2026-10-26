import { IsNotEmpty, IsString } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  @IsNotEmpty()
  externalDeviceKey!: string;
}
