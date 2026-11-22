import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const PROMOTION_TYPES = ['percentage', 'fixed_amount', 'free_shipping'] as const;

export class CreatePromotionDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(PROMOTION_TYPES)
  type!: (typeof PROMOTION_TYPES)[number];

  // Range (0-100 for percentage, >=0 for fixed_amount) is still enforced in
  // PromotionsService.create() since it depends on `type` - this only guarantees
  // it's a real number before that check runs.
  @IsNumber()
  value!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSubtotal?: number;

  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleProductIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedProductIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCategoryIds?: string[];

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalUsageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perCustomerLimit?: number;

  @IsOptional()
  @IsString()
  code?: string;
}

// update() in the service accepts the same shape, all optional - no field is
// individually required on an update.
export class UpdatePromotionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(PROMOTION_TYPES)
  type?: (typeof PROMOTION_TYPES)[number];

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSubtotal?: number;

  @IsOptional()
  @IsBoolean()
  firstOrderOnly?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleProductIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleCategoryIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedProductIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedCategoryIds?: string[];

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalUsageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perCustomerLimit?: number;

  @IsOptional()
  @IsString()
  code?: string;
}
