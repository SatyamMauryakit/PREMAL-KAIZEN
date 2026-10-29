import { Injectable, BadRequestException } from '@nestjs/common';

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  orderNumber?: string;
  message: string;
  createdAt: Date;
}

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
  // In-memory storage for demo (replace with database in production)
  private messages: ContactMessage[] = [];
  private submissionLog: Map<string, number[]> = new Map();

  async submitContactForm(submission: ContactSubmission): Promise<{ id: string; message: string }> {
    // Validate input
    this.validateSubmission(submission);

    // Check for rate limiting (max 5 submissions per email per hour)
    this.checkRateLimit(submission.email);

    // Create message record
    const message: ContactMessage = {
      id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: submission.name.trim(),
      email: submission.email.toLowerCase(),
      subject: submission.subject.trim(),
      category: submission.category,
      orderNumber: submission.orderNumber?.trim(),
      message: submission.message.trim(),
      createdAt: new Date(),
    };

    // Store message
    this.messages.push(message);

    // Log submission for rate limiting
    this.logSubmission(submission.email);

    // In production, send confirmation email here
    // For now, we just return success

    return {
      id: message.id,
      message: 'Thank you for contacting us. We will get back to you soon.',
    };
  }

  // Get all messages (admin only)
  async getAllMessages(limit = 50, offset = 0): Promise<{ messages: ContactMessage[]; total: number }> {
    return {
      messages: this.messages.slice(offset, offset + limit),
      total: this.messages.length,
    };
  }

  // Get messages by email
  async getMessagesByEmail(email: string): Promise<ContactMessage[]> {
    return this.messages.filter((m) => m.email === email.toLowerCase());
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
