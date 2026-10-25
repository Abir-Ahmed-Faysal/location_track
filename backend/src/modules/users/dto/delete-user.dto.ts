import { IsString, MinLength } from 'class-validator';

export class DeleteUserDto {
  @IsString()
  @MinLength(8)
  password!: string;
}
