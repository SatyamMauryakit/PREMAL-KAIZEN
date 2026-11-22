import { IsIn } from 'class-validator';

const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;

export class UpdateOrderPaymentStatusDto {
  @IsIn(PAYMENT_STATUSES)
  paymentStatus!: (typeof PAYMENT_STATUSES)[number];
}
