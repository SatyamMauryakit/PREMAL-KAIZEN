import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ContactService, ContactSubmission } from './contact.service';

function makeValidSubmission(overrides: Partial<ContactSubmission> = {}): ContactSubmission {
  return {
    name: 'Priya Sharma',
    email: 'priya@example.com',
    subject: 'Question about my order',
    category: 'order-status',
    message: 'Hi, I wanted to check on the status of my recent order please.',
    ...overrides,
  };
}

function makeDeps() {
  const prisma = {
    contactMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  } as any;

  const emailService = {
    sendContactEnquiryEmail: vi.fn().mockResolvedValue(true),
  } as any;

  return { prisma, emailService };
}

describe('ContactService.submitContactForm', () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: ContactService;

  beforeEach(() => {
    deps = makeDeps();
    service = new ContactService(deps.prisma, deps.emailService);
  });

  it('successful submission: persists the message and attempts a notification email', async () => {
    const created = {
      id: 'msg_1',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      subject: 'Question about my order',
      category: 'order-status',
      orderNumber: null,
      message: 'Hi, I wanted to check on the status of my recent order please.',
    };
    deps.prisma.contactMessage.create.mockResolvedValue(created);

    const result = await service.submitContactForm(makeValidSubmission());

    expect(result).toEqual({
      id: 'msg_1',
      message: 'Thank you for contacting us. We will get back to you soon.',
    });
    expect(deps.prisma.contactMessage.create).toHaveBeenCalledWith({
      data: {
        name: 'Priya Sharma',
        email: 'priya@example.com',
        subject: 'Question about my order',
        category: 'order-status',
        orderNumber: null,
        message: 'Hi, I wanted to check on the status of my recent order please.',
      },
    });
    // Let the fire-and-forget email promise settle before asserting on it.
    await new Promise((resolve) => setImmediate(resolve));
    expect(deps.emailService.sendContactEnquiryEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'priya@example.com', subject: 'Question about my order' }),
    );
  });

  it('invalid input: rejects a message that is too short, before ever touching the database', async () => {
    deps.prisma.contactMessage.create.mockResolvedValue({ id: 'should-not-be-created' });

    await expect(
      service.submitContactForm(makeValidSubmission({ message: 'too short' })),
    ).rejects.toThrow(BadRequestException);
    expect(deps.prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('invalid input: rejects an invalid email address', async () => {
    await expect(
      service.submitContactForm(makeValidSubmission({ email: 'not-an-email' })),
    ).rejects.toThrow(BadRequestException);
    expect(deps.prisma.contactMessage.create).not.toHaveBeenCalled();
  });

  it('invalid input: rejects an unknown category', async () => {
    await expect(
      service.submitContactForm(makeValidSubmission({ category: 'not-a-real-category' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('provider failure: a rejected/failed notification email does not fail the submission', async () => {
    const created = {
      id: 'msg_2',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      subject: 'Question about my order',
      category: 'order-status',
      orderNumber: null,
      message: 'Hi, I wanted to check on the status of my recent order please.',
    };
    deps.prisma.contactMessage.create.mockResolvedValue(created);
    deps.emailService.sendContactEnquiryEmail.mockRejectedValue(new Error('SMTP connection refused'));

    const result = await service.submitContactForm(makeValidSubmission());

    expect(result.id).toBe('msg_2');
    // Give the rejected fire-and-forget promise a tick to be caught internally,
    // so it doesn't surface as an unhandled rejection after the test completes.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('provider failure: email provider returning false (not configured) still succeeds', async () => {
    deps.prisma.contactMessage.create.mockResolvedValue({
      id: 'msg_3',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      subject: 'Question about my order',
      category: 'order-status',
      orderNumber: null,
      message: 'Hi, I wanted to check on the status of my recent order please.',
    });
    deps.emailService.sendContactEnquiryEmail.mockResolvedValue(false);

    await expect(service.submitContactForm(makeValidSubmission())).resolves.toEqual(
      expect.objectContaining({ id: 'msg_3' }),
    );
  });

  it('persistence failure: a database error propagates and no success message is returned', async () => {
    deps.prisma.contactMessage.create.mockRejectedValue(new Error('database is locked'));

    await expect(service.submitContactForm(makeValidSubmission())).rejects.toThrow('database is locked');
    expect(deps.emailService.sendContactEnquiryEmail).not.toHaveBeenCalled();
  });

  it('enforces the per-email rate limit after 5 submissions within an hour', async () => {
    deps.prisma.contactMessage.create.mockResolvedValue({
      id: 'msg_x',
      name: 'Priya Sharma',
      email: 'priya@example.com',
      subject: 'Question about my order',
      category: 'order-status',
      orderNumber: null,
      message: 'Hi, I wanted to check on the status of my recent order please.',
    });

    for (let i = 0; i < 5; i++) {
      await service.submitContactForm(makeValidSubmission());
    }

    await expect(service.submitContactForm(makeValidSubmission())).rejects.toThrow(
      'Too many submissions. Please try again later.',
    );
  });
});
