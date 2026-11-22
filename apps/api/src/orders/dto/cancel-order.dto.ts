import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const CANCELLATION_REASONS = [
  'mistake',
  'better_product',
  'changed_mind',
  'wrong_size',
  'delivery_too_long',
  'other',
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export class CancelOrderDto {
  @IsIn(CANCELLATION_REASONS)
  reason!: CancellationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
