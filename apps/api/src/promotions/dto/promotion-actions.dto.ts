import { ArrayMinSize, IsArray, IsBoolean, IsISO8601, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ToggleActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

export class CreateCouponCodesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsISO8601()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// Minimal shape for the cart items this validate-coupon preview needs to compute a
// discount against - matches what PromotionsService.validateAndApplyCoupon actually
// reads (productId/categoryId/quantity/price), not the full cart item shape.
export class CouponCartItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  price!: number;
}

// Deliberately NOT guarded by AuthGuard (see the controller's own KNOWN RISK comment -
// the real storefront checkout flow calls this without a session token today; fixing
// that is a coordinated frontend+backend change outside this DTO-only pass). userId is
// still client-supplied here, unlike every other mutating endpoint in this API - that
// is the pre-existing, documented risk, not something this DTO changes.
export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty()
  couponCode!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CouponCartItemDto)
  cartItems!: CouponCartItemDto[];

  @IsNumber()
  @Min(0)
  subtotal!: number;
}

export class RedeemCouponDto {
  @IsString()
  @IsNotEmpty()
  couponCode!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsNumber()
  @Min(0)
  discountAmount!: number;
}

export class ReleaseCouponDto {
  @IsString()
  @IsNotEmpty()
  couponCode!: string;

  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
