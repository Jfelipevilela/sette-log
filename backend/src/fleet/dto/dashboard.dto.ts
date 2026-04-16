import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsDateString } from "class-validator";

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
