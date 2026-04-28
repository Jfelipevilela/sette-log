import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";

export class DashboardQueryDto {
  @ApiPropertyOptional({ example: "2024-10-01" })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: "2024-10-31" })
  @IsOptional()
  @IsDateString()
  to?: string;
}

export class FuelSeriesQueryDto extends DashboardQueryDto {
  @ApiPropertyOptional({ example: "680f0d6cf6d0d3f8c1234567" })
  @IsOptional()
  @IsString()
  vehicleId?: string;

  @ApiPropertyOptional({ example: "day", enum: ["day", "month", "year"] })
  @IsOptional()
  @IsIn(["day", "month", "year"])
  granularity?: "day" | "month" | "year";
}
