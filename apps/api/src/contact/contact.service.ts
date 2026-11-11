import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

export interface ContactSubmission {
  name: string;
  email: string;
  subject: string;
  category: string;
  orderNumber?: string;
  message: string;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  // Rate-limit tracking only - ephemeral by nature, doesn't need to survive a restart.
  private submissionLog: Map<string, number[]> = new Map();

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async submitContactForm(submission: ContactSubmission): Promise<{ id: string; message: string }> {
    this.validateSubmission(submission);
    this.checkRateLimit(submission.email);

    const created = await this.prisma.contactMessage.create({
      data: {
        name: submission.name.trim(),
        email: submission.email.toLowerCase(),
        subject: submission.subject.trim(),
        category: submission.category,
        orderNumber: submission.orderNumber?.trim() || null,
        message: submission.message.trim(),
      },
    });

    this.logSubmission(submission.email);

    // The enquiry is already safely persisted above - a notification-email failure
    // (or no CONTACT_NOTIFICATION_EMAIL configured) must never lose it or turn this
    // into a user-facing error, so this is fire-and-forget with its own catch.
    this.emailService
      .sendContactEnquiryEmail({
        name: created.name,
        email: created.email,
        subject: created.subject,
        category: created.category,
        orderNumber: created.orderNumber,
        message: created.message,
      })
      .catch((err) => {
        this.logger.error(`Failed to send contact notification email: ${(err as Error).message}`);
      });

    return {
      id: created.id,
      message: 'Thank you for contacting us. We will get back to you soon.',
    };
  }

  // Get all messages (admin only - enforced at the controller via guards)
  async getAllMessages(limit = 50, offset = 0) {
    const [messages, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.contactMessage.count(),
    ]);

    return { messages, total };
  }

  // Get messages by email (admin only - enforced at the controller via guards)
  async getMessagesByEmail(email: string) {
    return this.prisma.contactMessage.findMany({
      where: { email: email.toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Private validation and utility methods

  private validateSubmission(submission: ContactSubmission) {
    // Name validation
    if (!submission.name || submission.name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }

    if (submission.name.length > 100) {
      throw new BadRequestException('Name must be less than 100 characters');
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!submission.email || !emailRegex.test(submission.email)) {
      throw new BadRequestException('Please enter a valid email address');
    }

    // Subject validation
    if (!submission.subject || submission.subject.trim().length < 3) {
      throw new BadRequestException('Subject must be at least 3 characters');
    }

    if (submission.subject.length > 200) {
      throw new BadRequestException('Subject must be less than 200 characters');
    }

    // Category validation
    const validCategories = [
      'order-status',
      'shipping',
      'returns',
      'product-question',
      'payment-issue',
      'general',
    ];

    if (!submission.category || !validCategories.includes(submission.category)) {
      throw new BadRequestException('Invalid enquiry category');
    }

    // Order number validation (if provided)
    if (submission.orderNumber) {
      if (submission.orderNumber.length > 50) {
        throw new BadRequestException('Order number must be less than 50 characters');
      }
    }

    // Message validation
    if (!submission.message || submission.message.trim().length < 10) {
      throw new BadRequestException('Message must be at least 10 characters');
    }

    if (submission.message.length > 5000) {
      throw new BadRequestException('Message must be less than 5000 characters');
    }
  }

  private checkRateLimit(email: string): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const submissions = this.submissionLog.get(email.toLowerCase()) || [];

    // Filter to submissions in the last hour
    const recentSubmissions = submissions.filter((timestamp) => timestamp > oneHourAgo);

    if (recentSubmissions.length >= 5) {
      throw new BadRequestException(
        'Too many submissions. Please try again later.'
      );
    }
  }

  private logSubmission(email: string): void {
    const key = email.toLowerCase();
    const submissions = this.submissionLog.get(key) || [];
    submissions.push(Date.now());

    // Clean up old entries (older than 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = submissions.filter((timestamp) => timestamp > oneDayAgo);

    this.submissionLog.set(key, filtered);
  }
}
