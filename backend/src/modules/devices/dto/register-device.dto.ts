import { IsIn, IsString, Length } from 'class-validator';

/** Request body for registering a device owned by the authenticated user. */
export class RegisterDeviceDto {
  @IsString()
  @Length(1, 255)
  externalDeviceKey!: string;

  @IsString()
  @IsIn(['ANDROID', 'IOS', 'WEB', 'OTHER'])
  platform!: string;
}
