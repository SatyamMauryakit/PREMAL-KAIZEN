import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateShippingDto {
  @IsOptional()
  @IsString()
  carrier?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsISO8601()
  estimatedDelivery?: string;
}
