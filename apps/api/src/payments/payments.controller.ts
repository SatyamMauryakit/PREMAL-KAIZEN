import { BadRequestException, Controller, Headers, Post, Body, Req, UseGuards, RawBodyRequest } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('api/payments/razorpay')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // Requires login - verification is tied to the order owner's session, never a
  // client-supplied userId. A generous but real limit: a flaky network mid-checkout
  // might retry a couple of times, but this should never be hammered.
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('verify')
  async verify(@Body() body: any, @Req() req: any) {
    return this.paymentsService.verifyPayment(req.user.id, body);
  }

  // Public (no session) - Razorpay calls this server-to-server. Authenticity comes
  // entirely from the webhook signature over the raw body, verified inside the service.
  // Never rate-limited: Razorpay retries failed/slow webhook deliveries on its own
  // schedule, and this endpoint rejecting a legitimate retry with 429 would risk an
  // order never getting marked paid. The signature check is the real security boundary
  // here, not request volume.
  @SkipThrottle()
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) {
    if (!req.rawBody) {
      throw new BadRequestException('Raw request body is required for webhook verification');
    }
    return this.paymentsService.handleWebhook(req.rawBody, signature);
  }
}
