import { Injectable, BadRequestException, UnauthorizedException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { AdminAuditLogService } from '../common/rbac/admin-audit-log.service';
import { AdminRole, isAdminRole } from '../common/rbac/permissions';
import { assertCanSend, assertDelivered, issueOtp, verifyAndConsumeOtp, OTP_RESEND_COOLDOWN_SECONDS } from './otp.utils';

const BCRYPT_ROUNDS = 10;
/** OTP config - all purposes expire in 5 minutes per security policy. */
const OTP_EXPIRY_MINUTES = 5;
const LOGIN_OTP_EXPIRY_MINUTES = 5;
const LOGIN_OTP_RESEND_COOLDOWN_SECONDS = OTP_RESEND_COOLDOWN_SECONDS;

interface LoginResult {
  sessionToken: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    adminRole: string | null;
    emailVerified: Date | null;
  };
}

/**
 * IdentityService
 * Manages user authentication: registration, login, password resets, email
 * verification, and the login OTP second factor.
 *
 * Mobile numbers are collected and stored (for order/delivery contact
 * purposes) but are NOT OTP-verified anywhere in this app - there is no
 * mobile verification flow, and `phoneVerified` is never set by any code
 * path here. Email remains the only verified identifier and the only
 * channel used for the login second factor.
 */
@Injectable()
export class IdentityService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private adminAuditLog: AdminAuditLogService,
  ) { }

  /**
   * Register a new customer account. A mobile number may optionally be
   * provided and is stored as-is (normalized) - it is never verified and
   * never gates login; only email verification does.
   */
  async register(email: string, password: string, firstName?: string, lastName?: string, phoneNumber?: string) {
    const user = await this.createUser(email, password, firstName, lastName, 'customer', undefined, phoneNumber);

    // Welcome email (non-blocking - never throws if email is unconfigured)
    this.emailService.sendWelcomeEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
    }).catch(() => undefined);

    // Email verification OTP (non-blocking - a provider hiccup at this exact
    // moment never fails registration; the verify-email screen offers resend).
    this.sendEmailOtp(user.email).catch(() => undefined);

    return user;
  }

  /**
   * Returns true if any administrator account already exists.
   * Used to gate the one-time first-admin bootstrap.
   */
  async adminExists(): Promise<boolean> {
    const count = await this.prisma.user.count({ where: { role: 'admin' } });
    return count > 0;
  }

  /**
   * Create the first administrator account. Only works while no admin exists
   * yet - self-disables permanently after the first successful call, so this
   * can safely be exposed on a public endpoint.
   */
  async bootstrapFirstAdmin(email: string, password: string, firstName?: string, lastName?: string) {
    if (await this.adminExists()) {
      throw new ConflictException('An administrator already exists. Ask an existing admin to create your account.');
    }
    return this.createUser(email, password, firstName, lastName, 'admin', 'SUPER_ADMIN');
  }

  /**
   * Create an additional administrator. Caller must already be authenticated
   * as an admin (enforced by AuthGuard + AdminGuard + PermissionGuard('admins:manage')
   * on the controller route). Assigning SUPER_ADMIN specifically requires the
   * acting admin to already be a SUPER_ADMIN - the one place privilege
   * escalation is explicitly blocked, rather than left implicit in a permission
   * check alone.
   */
  async createAdmin(
    email: string,
    password: string,
    firstName: string | undefined,
    lastName: string | undefined,
    adminRole: AdminRole,
    actor: { id: string; email: string; adminRole: AdminRole | null },
  ) {
    if (!isAdminRole(adminRole)) {
      throw new BadRequestException('Invalid admin role');
    }
    if (adminRole === 'SUPER_ADMIN' && actor.adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a Super Admin can grant Super Admin access');
    }

    const user = await this.createUser(email, password, firstName, lastName, 'admin', adminRole);

    await this.adminAuditLog.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.create',
      targetId: user.id,
      details: { email: user.email, adminRole },
    });

    return user;
  }

  /**
   * List every administrator account (role = 'admin') for the admin-management UI.
   */
  async listAdmins() {
    const admins = await this.prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        adminRole: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    return admins;
  }

  /**
   * Change an existing administrator's granular role. Only a SUPER_ADMIN may
   * assign SUPER_ADMIN - enforced explicitly here, not just by holding
   * admins:manage (which other roles never hold anyway, but this keeps the
   * escalation rule self-contained and explicit).
   */
  async changeAdminRole(
    targetId: string,
    newRole: AdminRole,
    actor: { id: string; email: string; adminRole: AdminRole | null },
  ) {
    if (!isAdminRole(newRole)) {
      throw new BadRequestException('Invalid admin role');
    }
    if (newRole === 'SUPER_ADMIN' && actor.adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a Super Admin can grant Super Admin access');
    }

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.role !== 'admin') {
      throw new NotFoundException('Administrator not found');
    }

    if (target.adminRole === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN' && actor.adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a Super Admin can change another Super Admin\'s role');
    }

    if (target.adminRole === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const remainingSuperAdmins = await this.prisma.user.count({
        where: { role: 'admin', adminRole: 'SUPER_ADMIN', isActive: true, id: { not: targetId } },
      });
      if (remainingSuperAdmins === 0) {
        throw new BadRequestException('Cannot change the role of the last active Super Admin');
      }
    }

    const previousRole = target.adminRole;
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { adminRole: newRole },
    });

    await this.adminAuditLog.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.role_change',
      targetId,
      details: { email: target.email, previousRole, newRole },
    });

    const { password: _pw, ...withoutPassword } = updated;
    return withoutPassword;
  }

  /**
   * Activate or deactivate an administrator account. Guards against the last
   * active Super Admin deactivating themselves (or being deactivated), which
   * would otherwise permanently lock everyone out of admin management.
   */
  async setAdminStatus(
    targetId: string,
    isActive: boolean,
    actor: { id: string; email: string; adminRole: AdminRole | null },
  ) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || target.role !== 'admin') {
      throw new NotFoundException('Administrator not found');
    }

    if (!isActive && target.adminRole === 'SUPER_ADMIN') {
      const remainingSuperAdmins = await this.prisma.user.count({
        where: { role: 'admin', adminRole: 'SUPER_ADMIN', isActive: true, id: { not: targetId } },
      });
      if (remainingSuperAdmins === 0) {
        throw new BadRequestException('Cannot deactivate the last active Super Admin');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { isActive },
    });

    await this.adminAuditLog.log({
      actorId: actor.id,
      actorEmail: actor.email,
      action: isActive ? 'admin.activate' : 'admin.deactivate',
      targetId,
      details: { email: target.email },
    });

    const { password: _pw, ...withoutPassword } = updated;
    return withoutPassword;
  }

  /**
   * Admin action history. Scoped to actions a given admin has performed
   * (actorId) for the per-admin "view activity" UI.
   */
  async getAdminActivity(actorId: string, limit?: number, offset?: number) {
    return this.adminAuditLog.list({ actorId, limit, offset });
  }

  private async createUser(
    email: string,
    password: string,
    firstName: string | undefined,
    lastName: string | undefined,
    role: 'customer' | 'admin',
    adminRole?: AdminRole,
    phoneNumber?: string,
  ) {
    if (!this.isValidEmail(email)) {
      throw new BadRequestException('Invalid email format');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Mobile number is optional, stored permanently once provided, and never
    // verified - only light format normalization is applied.
    let normalizedPhone: string | null = null;
    if (phoneNumber && phoneNumber.trim()) {
      normalizedPhone = this.normalizePhone(phoneNumber);
      if (!this.isValidPhone(normalizedPhone)) {
        throw new BadRequestException('Enter a valid mobile number with country code');
      }
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        adminRole: role === 'admin' ? adminRole ?? null : null,
        firstName: firstName || null,
        lastName: lastName || null,
        phoneNumber: normalizedPhone,
        emailVerified: role === 'admin' ? new Date() : null,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Step 1-3 of the mandatory login flow: validate credentials, then either
   * issue a session immediately (admin - see below) or issue a fresh login
   * OTP by email and return `requiresOtp: true` with NO session of any kind.
   * A customer session is only ever created by verifyLoginOtp below - there
   * is no code path that lets a correct password alone produce a session or
   * cookie for a customer account.
   *
   * Admin accounts are exempted: the admin panel shares this exact endpoint
   * and has no OTP-entry UI of its own, so forcing this step for admins
   * would lock every admin out rather than add security (admin access is
   * already gated by its own RBAC/session model).
   */
  async login(email: string, password: string): Promise<{ requiresOtp: true; email: string; message: string } | LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been disabled');
    }

    // Support bcrypt hashes; fall back to legacy base64 hashes created before
    // the bcrypt migration and transparently upgrade them on successful login.
    let isPasswordValid: boolean;
    const looksLikeBcryptHash = /^\$2[aby]\$/.test(user.password);

    if (looksLikeBcryptHash) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } else {
      const legacyHash = Buffer.from(password).toString('base64');
      isPasswordValid = legacyHash === user.password;
      if (isPasswordValid) {
        const upgradedHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        await this.prisma.user.update({
          where: { id: user.id },
          data: { password: upgradedHash },
        });
      }
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Require email verification before even starting the login-OTP step -
    // a customer could otherwise register and never complete registration
    // verification yet still receive login OTPs. Admin accounts are
    // auto-verified at creation (see createUser) and are never subject to
    // this gate. The response carries a machine-readable `code` so the
    // frontend can route the customer to the verify-email page (with a
    // resend option) instead of showing a generic login error.
    if (user.role === 'customer' && !user.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before logging in. Check your inbox for the verification code, or request a new one.',
        email: user.email,
      });
    }

    if (user.role === 'admin') {
      return this.issueSession(user);
    }

    await this.issueLoginOtp(user);
    return {
      requiresOtp: true,
      email: user.email,
      message: 'Verification code sent. Please check your email to complete login.',
    };
  }

  /**
   * Step 4-6 of the mandatory login flow: verify the login OTP and only then
   * create the authenticated session. The OTP is single-use (consumed on
   * success), attempt-limited, and expires after LOGIN_OTP_EXPIRY_MINUTES -
   * this is the *only* place a customer session is ever created.
   */
  async verifyLoginOtp(email: string, otp: string): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase();

    // The user is fetched fresh here (not trusted from any prior step) so the
    // session is issued for the exact, current user record - never a stale
    // or spoofed identity.
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not available. Please contact support.');
    }

    await verifyAndConsumeOtp(this.prisma, { destination: normalizedEmail, purpose: 'login_otp', otp });

    return this.issueSession(user);
  }

  /**
   * Explicit "resend" action for the login-OTP step. Deliberately only sends
   * a fresh code when a login OTP is *already* pending for this email (i.e.
   * a password was already verified once to get here) - this is never a
   * standalone, password-free way to trigger an OTP send for an arbitrary
   * account, which would otherwise be an enumeration/spam vector.
   */
  async resendLoginOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    const existing = await this.prisma.verificationToken.findFirst({
      where: { email: normalizedEmail, type: 'login_otp' },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      // Same generic response either way - don't confirm whether a login is in progress.
      return { message: 'If a login is in progress for this email, a new code has been sent.' };
    }

    const elapsedMs = Date.now() - existing.createdAt.getTime();
    if (elapsedMs < LOGIN_OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      throw new BadRequestException(
        `Please wait ${LOGIN_OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new code.`,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return { message: 'If a login is in progress for this email, a new code has been sent.' };
    }

    await this.issueLoginOtp(user, { force: true });
    return { message: 'A new verification code has been sent.' };
  }

  private async issueSession(user: { id: string; email: string; firstName: string | null; lastName: string | null; role: string; adminRole: string | null; emailVerified: Date | null }): Promise<LoginResult> {
    const session = await this.createSession(user.id);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return {
      sessionToken: session.token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        adminRole: user.adminRole,
        emailVerified: user.emailVerified,
      },
    };
  }

  /**
   * Generates, hashes, stores (type = 'login_otp'), and emails a fresh login
   * OTP. Without `force`, a still-valid recently-issued code is silently left
   * in place (the user just re-submitted their password, not explicitly
   * asking to resend) rather than being replaced - avoids spamming a new
   * email on every retry within the cooldown window. Throws (rather than
   * reporting success) if the email provider cannot confirm delivery.
   */
  private async issueLoginOtp(user: { id: string; email: string; firstName: string | null }, options?: { force?: boolean }): Promise<void> {
    if (!options?.force) {
      const existing = await this.prisma.verificationToken.findFirst({
        where: { email: user.email, type: 'login_otp' },
        orderBy: { createdAt: 'desc' },
      });
      if (existing && Date.now() - existing.createdAt.getTime() < LOGIN_OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        return;
      }
    }

    await assertCanSend(this.prisma, user.email, 'login_otp', LOGIN_OTP_RESEND_COOLDOWN_SECONDS);
    const { otp } = await issueOtp(this.prisma, {
      destination: user.email,
      purpose: 'login_otp',
      userId: user.id,
      expiryMinutes: LOGIN_OTP_EXPIRY_MINUTES,
    });

    const delivered = await this.emailService.sendEmailOtpEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
      otp,
      expiryMinutes: LOGIN_OTP_EXPIRY_MINUTES,
    }).catch(() => false);
    assertDelivered(delivered, 'login_otp', user.email);
  }

  /**
   * Logout user
   * @param sessionToken - Session token to invalidate
   */
  async logout(sessionToken: string) {
    await this.prisma.session.deleteMany({
      where: { token: sessionToken },
    });
  }

  /**
   * Validate session and get user
   * @param sessionToken - Session token
   * @returns User object if valid, null otherwise
   */
  async validateSession(sessionToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      // Delete expired session
      if (session) {
        await this.prisma.session.delete({
          where: { token: sessionToken },
        });
      }
      return null;
    }

    const { password: _, ...userWithoutPassword } = session.user;
    return userWithoutPassword;
  }

  /**
   * Send password reset email
   * @param email - User email
   */
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // For security, the response is identical whether or not the email is
    // registered - distinct wording would let an attacker enumerate accounts
    // even though both cases already share the same 200 status.
    const message = 'If an account exists for this email, a password reset link has been sent.';

    if (!user) {
      return { message };
    }

    // Create reset token
    const tokenRow = await this.createVerificationToken(user.email, 'password_reset');

    // Send the password reset email (non-blocking)
    const resetUrl = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/auth/reset-password?token=${tokenRow.token}`;
    this.emailService.sendPasswordResetEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
      resetUrl,
    }).catch(() => undefined);

    return { message };
  }

  /**
   * Reset password
   * @param token - Reset token
   * @param newPassword - New password
   */
  async resetPassword(token: string, newPassword: string) {
    // Validate password
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    // Find token
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.type !== 'password_reset') {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: verificationToken.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password with bcrypt
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and delete token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    await this.prisma.verificationToken.delete({
      where: { token },
    });

    return { message: 'Password reset successful' };
  }

  /**
   * Verify email
   * @param token - Verification token
   */
  async verifyEmail(token: string) {
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken || verificationToken.type !== 'email_verification') {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: verificationToken.email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Mark email as verified and delete token
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    });

    await this.prisma.verificationToken.delete({
      where: { token },
    });

    return { message: 'Email verified successfully' };
  }

  // ========================================================================
  // Email OTP verification (registration)
  // ========================================================================

  /**
   * Generate a 6-digit numeric OTP, hash it, store it (type = 'email_otp'),
   * and email it. Resends are rate-limited (60s cooldown, 5/hour per
   * destination) and a destination locked out after too many failed verify
   * attempts cannot receive a fresh code until the lockout clears (see
   * otp.utils). If the email provider does not confirm delivery, this
   * throws rather than reporting success - the only exception is the
   * anti-enumeration early-returns below, which never attempt a send at all.
   */
  async sendEmailOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();
    await assertCanSend(this.prisma, normalizedEmail, 'email_otp');

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Don't reveal whether an account exists — identical response either way.
    if (!user) {
      return { message: 'If an account exists for this email, a verification code has been sent.' };
    }

    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    const { otp } = await issueOtp(this.prisma, {
      destination: normalizedEmail,
      purpose: 'email_otp',
      userId: user.id,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });

    const delivered = await this.emailService.sendEmailOtpEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
      otp, // plaintext sent only in the email, never logged or stored
      expiryMinutes: OTP_EXPIRY_MINUTES,
    }).catch(() => false);
    assertDelivered(delivered, 'email_otp', normalizedEmail);

    return { message: 'Verification code sent. Please check your email.' };
  }

  /**
   * Verify a 6-digit email OTP. On success marks the email as verified and
   * immediately issues a session - email verification is the only
   * activation step a customer account needs, so this logs them straight in
   * (the frontend redirects Home) instead of sending them to a manual login.
   */
  async verifyEmailOtp(email: string, otp: string): Promise<{ message: string; sessionReady: true; sessionToken: string; user: LoginResult['user'] }> {
    const normalizedEmail = email.toLowerCase();

    await verifyAndConsumeOtp(this.prisma, { destination: normalizedEmail, purpose: 'email_otp', otp });

    const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!existingUser) {
      throw new BadRequestException('No account found for this email.');
    }

    await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: new Date() },
    });

    const session = await this.issueSession({
      id: existingUser.id,
      email: existingUser.email,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      role: existingUser.role,
      adminRole: existingUser.adminRole,
      emailVerified: new Date(),
    });

    return { message: 'Email verified successfully.', sessionReady: true, ...session };
  }

  /** Light normalization: bare 10-digit Indian numbers get a +91 prefix; anything already prefixed is left as-is. */
  private normalizePhone(phone: string): string {
    const trimmed = phone.trim();
    const digitsOnly = trimmed.replace(/[^\d]/g, '');
    if (!trimmed.startsWith('+') && digitsOnly.length === 10) {
      return `+91${digitsOnly}`;
    }
    return trimmed;
  }

  /** Loose E.164-style check after normalization: a leading '+' and 8-15 digits. */
  private isValidPhone(normalizedPhone: string): boolean {
    return /^\+[1-9]\d{7,14}$/.test(normalizedPhone);
  }

  // ========================================================================
  // Private helper methods
  // ========================================================================

  private async createSession(userId: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return this.prisma.session.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  private async createVerificationToken(email: string, type: 'email_verification' | 'password_reset') {
    // Delete existing tokens of this type
    await this.prisma.verificationToken.deleteMany({
      where: {
        email: email.toLowerCase(),
        type,
      },
    });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    return this.prisma.verificationToken.create({
      data: {
        email: email.toLowerCase(),
        token,
        type,
        expiresAt,
      },
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
