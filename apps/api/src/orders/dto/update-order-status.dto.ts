import { IsIn } from 'class-validator';

// Mirrors VALID_ORDER_STATUSES in orders.service.ts - kept as a literal list here
// (not imported) since that constant isn't exported; the service's own
// STATUS_TRANSITIONS check remains the authority on which transitions are actually
// allowed from the order's current status - this DTO only rejects a nonsense string
// before it ever reaches that check.
const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'return_requested',
  'return_approved',
  'return_rejected',
] as const;

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES)
  status!: (typeof ORDER_STATUSES)[number];
}
