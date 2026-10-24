import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MinLength,
  MaxLength,
} from 'class-validator';

export class SignupDto {
  @IsOptional()
  @IsString()
  @Length(2, 20)
  name?: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}