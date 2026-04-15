import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';

export class GeoPointDto {
  @ApiProperty({ example: 'Point' })
  @IsIn(['Point'])
  type: 'Point';

  @ApiProperty({ example: [-46.6333, -23.5505] })
  @IsArray()
  coordinates: [number, number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC1D23' })
  @IsString()
  plate: string;

  @ApiProperty({ example: 'Mercedes-Benz' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Actros 2651' })
  @IsString()
  model: string;

  @ApiPropertyOptional({ example: 'Carro do Joao' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiPropertyOptional({ example: 'truck' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenter?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryDriverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  odometerKm?: number;

  @ApiPropertyOptional({ example: 55 })
  @IsOptional()
  @IsNumber()
  tankCapacityLiters?: number;
}

export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateDriverDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  licenseNumber: string;

  @ApiProperty()
  @IsString()
  licenseCategory: string;

  @ApiProperty()
  @IsDateString()
  licenseExpiresAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedVehicleId?: string;
}

export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateTelemetryEventDto {
  @ApiProperty()
  @IsString()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trackerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverId?: string;

  @ApiProperty({ example: 'gps' })
  @IsString()
  type: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location: GeoPointDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  speedKph?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fuelLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  odometerKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  batteryVoltage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ignition?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class CreateDocumentDto {
  @ApiProperty()
  @IsString()
  entityType: string;

  @ApiProperty()
  @IsString()
  entityId: string;

  @ApiProperty({ example: 'crlv' })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class GenericRecordDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, unknown>;
}
