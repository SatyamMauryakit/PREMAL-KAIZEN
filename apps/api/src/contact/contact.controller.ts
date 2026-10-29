import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ContactService, ContactSubmission } from './contact.service';

@Controller('api/contact')
export class ContactController {
  constructor(private contactService: ContactService) {}

  @Post('submit')
  async submitContactForm(@Body() submission: ContactSubmission) {
    return this.contactService.submitContactForm(submission);
  }

  @Get('messages')
  async getMessages(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.contactService.getAllMessages(
      limit ? parseInt(limit) : 50,
      offset ? parseInt(offset) : 0
    );
  }

  @Get('messages/email/:email')
  async getMessagesByEmail(@Query() query: any) {
    return this.contactService.getMessagesByEmail(query.email);
  }
}
