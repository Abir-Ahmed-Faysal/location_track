import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** Transport DTO for one canonical location event. */
export class LocationEventDto {
  @IsUUID('4') eventId!: string;
  @IsString() deviceId!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsNumber() @Min(0) accuracyM?: number | null;
  @IsDateString() capturedAt!: string;
  @IsOptional() @IsNumber() @Min(0) sequence?: number | null;
  @IsOptional() @IsString() provider?: string | null;
  @IsOptional() @IsNumber() altitudeM?: number | null;
  @IsOptional() @IsNumber() @Min(0) speedMps?: number | null;
  @IsOptional() @IsNumber() @Min(0) @Max(359.999999) bearingDeg?: number | null;
  @IsOptional() @IsString() platformVersion?: string | null;
  @IsOptional() @IsBoolean() mockLocationIndicator?: boolean | null;
}

/** Transport DTO for atomic batch ingestion. */
export class IngestBatchDto {
  schemaVersion!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocationEventDto)
  events!: LocationEventDto[];
}
