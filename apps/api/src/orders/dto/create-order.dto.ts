import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  selectedSize?: string;

  @IsOptional()
  @IsString()
  selectedColor?: string;
}

// A new shipping address submitted inline at checkout. Field-level format checks
// (valid 10-digit Indian mobile, 6-digit PIN) are already enforced in
// OrdersService.create() against the exact same fields - this DTO only guarantees
// the right fields are present as non-empty strings before the service ever runs,
// not a duplicate of that business-rule validation.
export class OrderShippingAddressDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  street1!: string;

  @IsOptional()
  @IsString()
  street2?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  state!: string;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  // Exactly one of addressId (a saved address) or shippingAddress (inline, new) is
  // expected - OrdersService.create() already enforces that at least one resolves to
  // a real address; this DTO doesn't duplicate that either/or check, just shapes each.
  @IsOptional()
  @IsString()
  addressId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrderShippingAddressDto)
  shippingAddress?: OrderShippingAddressDto;

  @IsOptional()
  @IsIn(['card', 'upi', 'netbanking', 'cod'])
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  shippingMethod?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
