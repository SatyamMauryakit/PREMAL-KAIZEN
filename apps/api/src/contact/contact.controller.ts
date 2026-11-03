import { Controller, Post, Body, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ContactService, ContactSubmission } from './contact.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('api/contact')
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Post('submit')
  async submitContactForm(@Body() submission: ContactSubmission) {
    return this.contactService.submitContactForm(submission);
  }

  // Reading submitted messages exposes customer PII (name, email, order number) -
  // admin-only, same as every other customer-data read endpoint.
  @UseGuards(AuthGuard, AdminGuard)
  @Get('messages')
  async getMessages(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.contactService.getAllMessages(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0
    );
  }

  @UseGuards(AuthGuard, AdminGuard)
  @Get('messages/email/:email')
  async getMessagesByEmail(@Param('email') email: string) {
    return this.contactService.getMessagesByEmail(email);
  }
}
