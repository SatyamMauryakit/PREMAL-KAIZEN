/**
 * Shape of the payload JSON stored on a NotificationEvent and later deserialized by
 * the processor to render the email. Fields are optional because different event types
 * need different subsets. All monetary values are in paise (the project's storage unit),
 * and are converted to display rupees only at render time.
 */
export interface NotificationPayload {
  toEmail: string;
  customerName: string;
  orderNumber: string;
  orderId: string;

  // Monetary fields — paise
  total?: number;
  subtotal?: number;
  discount?: number;
  shipping?: number;
  tax?: number;
  paymentMethod?: string;
  paymentStatus?: string;

  orderDate?: string; // ISO

  items?: Array<{
    name: string;
    quantity: number;
    price: number; // paise (unit price)
    selectedSize?: string | null;
    selectedColor?: string | null;
  }>;

  shippingSummary?: string;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    street1: string;
    street2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phoneNumber: string;
  } | null;

  // Only included when an expected delivery date is actually on file.
  expectedDelivery?: string | null;

  // Status-transition events
  newStatus?: string;
  fromStatus?: string;
  carrier?: string | null;
  trackingNumber?: string | null;

  invoiceNumber?: string | null;
}

export type NotificationEventType =
  | 'order_placed'
  | 'payment_captured'
  | 'payment_failed'
  | 'payment_refunded'
  | 'status_confirmed'
  | 'status_processing'
  | 'status_packed'
  | 'status_shipped'
  | 'status_out_for_delivery'
  | 'status_delivered'
  | 'status_cancelled'
  | 'status_return_requested'
  | 'status_return_approved'
  | 'status_return_rejected';
