import { NotificationPayload } from './notification.types';

/**
 * Maps a fully-loaded order (with items+product, address, user) to the email payload
 * snapshot. Amounts stay in paise and are converted to display rupees only at render
 * time. Shared by OrdersService (order placement + status changes) and PaymentsService
 * (capture/failure/refund) so the payload shape is identical everywhere.
 */
export function buildOrderPayload(order: any): NotificationPayload {
  return {
    toEmail: order.user?.email ?? '',
    customerName: order.user?.firstName || order.user?.email || 'Customer',
    orderNumber: order.orderNumber,
    orderId: order.id,
    total: order.total,
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shipping,
    tax: order.tax,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderDate: order.createdAt instanceof Date ? order.createdAt.toISOString() : String(order.createdAt),
    items: (order.items ?? []).map((i: any) => ({
      name: i.product?.name ?? 'Product',
      quantity: i.quantity,
      price: i.price,
      selectedSize: i.selectedSize,
      selectedColor: i.selectedColor,
    })),
    shippingSummary: order.address ? `${order.address.city}, ${order.address.state} ${order.address.postalCode}` : undefined,
    shippingAddress: order.address
      ? {
          firstName: order.address.firstName,
          lastName: order.address.lastName,
          street1: order.address.street1,
          street2: order.address.street2,
          landmark: order.address.landmark,
          city: order.address.city,
          state: order.address.state,
          postalCode: order.address.postalCode,
          country: order.address.country,
          phoneNumber: order.address.phoneNumber,
        }
      : null,
    expectedDelivery: order.estimatedDelivery
      ? order.estimatedDelivery instanceof Date
        ? order.estimatedDelivery.toISOString()
        : String(order.estimatedDelivery)
      : null,
    carrier: order.carrier ?? null,
    trackingNumber: order.trackingNumber ?? null,
  };
}
