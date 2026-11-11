import { Injectable, BadRequestException, UnauthorizedException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { maskEmail } from '../common/logging/redact';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { AdminAuditLogService } from '../common/rbac/admin-audit-log.service';
import { AdminRole, isAdminRole } from '../common/rbac/permissions';

const BCRYPT_ROUNDS = 10;
/** OTP config */
const OTP_DIGITS = 6;
const OTP_EXPIRY_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;          // max verify failures before OTP is invalidated
const OTP_RESEND_COOLDOWN_SECONDS = 60; // minimum gap between consecutive sends
/** Mobile OTP config - shorter expiry than email per spec; same hashing/cooldown pattern. */
const MOBILE_OTP_EXPIRY_MINUTES = 5;
/** Login OTP (mandatory 2nd factor on every customer login) - 5 minutes per spec, same hashing/attempt-limit/cooldown pattern as the others. */
const LOGIN_OTP_EXPIRY_MINUTES = 5;
const LOGIN_OTP_RESEND_COOLDOWN_SECONDS = 60;

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
 * Manages user authentication: registration, login, password resets, email verification.
 * This service owns:
 * - User credentials (passwords, hashed)
 * - Authentication tokens and sessions
 * - Email verification and password reset tokens
 * - Session management
 */
@Injectable()
export class IdentityService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private adminAuditLog: AdminAuditLogService,
    private smsService?: SmsService,
  ) { }

  /**
   * Register a new customer account
   * @param email - Customer email
   * @param password - Plain text password (will be hashed)
   * @param firstName - First name
   * @param lastName - Last name
   * @returns User object (without password)
   */
  async register(email: string, password: string, firstName?: string, lastName?: string, phoneNumber?: string) {
    const user = await this.createUser(email, password, firstName, lastName, 'customer', undefined, phoneNumber);

    // Send welcome email (non-blocking — never throws if email is unconfigured)
    this.emailService.sendWelcomeEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
    }).catch(() => undefined);

    // Issue a numeric OTP and email it (non-blocking)
    this.sendEmailOtp(user.email).catch(() => undefined);

    // Phone number is optional at signup - only send a mobile OTP when one was given.
    if (phoneNumber) {
      this.sendMobileOtp(phoneNumber).catch(() => undefined);
    }

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

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        adminRole: role === 'admin' ? adminRole ?? null : null,
        firstName: firstName || null,
        lastName: lastName || null,
        phoneNumber: phoneNumber ? this.normalizePhone(phoneNumber) : null,
        emailVerified: role === 'admin' ? new Date() : null,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Step 1-3 of the mandatory login flow: validate credentials, then either
   * issue a session immediately (admin - see below) or issue a fresh login
   * OTP and return `requiresOtp: true` with NO session of any kind. A
   * customer session is only ever created by verifyLoginOtp below - there is
   * no code path that lets a correct password alone produce a session or
   * cookie for a customer account.
   *
   * Admin accounts are exempted: the admin panel shares this exact endpoint
   * and has no OTP-entry UI of its own, so forcing this step for admins
   * would lock every admin out rather than add security (admin access is
   * already gated by its own RBAC/session model).
   *
   * @param email - User email
   * @param password - Plain text password
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
   * create the authenticated session. The OTP is single-use (deleted on
   * success), attempt-limited, and expires after LOGIN_OTP_EXPIRY_MINUTES -
   * this is the *only* place a customer session is ever created.
   */
  async verifyLoginOtp(email: string, otp: string): Promise<LoginResult> {
    const normalizedEmail = email.toLowerCase();

    const tokenRow = await this.prisma.verificationToken.findFirst({
      where: { email: normalizedEmail, type: 'login_otp' },
    });

    if (!tokenRow) {
      throw new BadRequestException('No pending login verification found. Please log in again.');
    }

    if (tokenRow.expiresAt < new Date()) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new BadRequestException('Verification code has expired. Please log in again to receive a new one.');
    }

    if (tokenRow.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new BadRequestException('Too many incorrect attempts. Please log in again to receive a new code.');
    }

    const isValid = await bcrypt.compare(otp.trim(), tokenRow.token);
    if (!isValid) {
      await this.prisma.verificationToken.update({
        where: { id: tokenRow.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect verification code. Please try again.');
    }

    // The user row is re-fetched (not trusted from the OTP row, which only
    // carries an email) so the session is issued for the exact, current user
    // record tied to this verified email - never a stale or spoofed identity.
    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.isActive) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new UnauthorizedException('Account not available. Please contact support.');
    }

    // Single-use: delete immediately so the same code can never be replayed.
    await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });

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
   * email on every retry within the cooldown window.
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

    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(OTP_DIGITS, '0');
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + LOGIN_OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.verificationToken.deleteMany({ where: { email: user.email, type: 'login_otp' } });
    await this.prisma.verificationToken.create({
      data: { email: user.email, token: otpHash, type: 'login_otp', expiresAt },
    });

    this.emailService.sendEmailOtpEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
      otp,
      expiryMinutes: LOGIN_OTP_EXPIRY_MINUTES,
    }).catch(() => undefined);
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
  // Email OTP verification
  // ========================================================================

  /**
   * Generate a 6-digit numeric OTP, bcrypt-hash it, store it in the
   * VerificationToken table (type = 'email_otp'), and email it.
   * Re-sends are rate-limited: a new OTP cannot be issued until
   * OTP_RESEND_COOLDOWN_SECONDS have elapsed since the last one.
   * The OTP itself is NEVER returned or logged.
   */
  async sendEmailOtp(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    // Check for an existing OTP issued recently (rate-limit re-send)
    const existing = await this.prisma.verificationToken.findFirst({
      where: { email: normalizedEmail, type: 'email_otp' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      const elapsedMs = Date.now() - existing.createdAt.getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        throw new BadRequestException(
          `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new code.`,
        );
      }
    }

    const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Don't reveal whether an account exists — identical response either way.
    if (!user) {
      return { message: 'If an account exists for this email, a verification code has been sent.' };
    }

    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    // Generate cryptographically random 6-digit OTP
    const otp = (crypto.randomInt(0, 1_000_000)).toString().padStart(OTP_DIGITS, '0');
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store hashed OTP — replace any prior pending OTP for this email
    await this.prisma.verificationToken.deleteMany({ where: { email: normalizedEmail, type: 'email_otp' } });
    await this.prisma.verificationToken.create({
      data: { email: normalizedEmail, token: otpHash, type: 'email_otp', expiresAt },
    });

    // Send email (non-blocking — never throws)
    this.emailService.sendEmailOtpEmail({
      toEmail: user.email,
      customerName: user.firstName || user.email,
      otp, // plaintext sent only in the email, never logged or stored
      expiryMinutes: OTP_EXPIRY_MINUTES,
    }).catch(() => undefined);

    return { message: 'Verification code sent. Please check your email.' };
  }

  /**
   * Verify a 6-digit OTP submitted by the user. On success marks the email
   * as verified and deletes the OTP row (single-use - the same code can
   * never be replayed). After OTP_MAX_ATTEMPTS incorrect attempts the row is
   * invalidated and the user must request a new code, on top of the
   * controller's IP-based throttling.
   */
  async verifyEmailOtp(email: string, otp: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase();

    const tokenRow = await this.prisma.verificationToken.findFirst({
      where: { email: normalizedEmail, type: 'email_otp' },
    });

    if (!tokenRow) {
      throw new BadRequestException('No pending verification code found. Please request a new one.');
    }

    if (tokenRow.expiresAt < new Date()) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (tokenRow.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new BadRequestException('Too many incorrect attempts. Please request a new verification code.');
    }

    const isValid = await bcrypt.compare(otp.trim(), tokenRow.token);

    if (!isValid) {
      await this.prisma.verificationToken.update({
        where: { id: tokenRow.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect verification code. Please try again.');
    }

    // Mark email verified and clean up
    await this.prisma.user.update({
      where: { email: normalizedEmail },
      data: { emailVerified: new Date() },
    });
    await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });

    return { message: 'Email verified successfully.' };
  }

  // ========================================================================
  // Mobile OTP verification
  // ========================================================================
  //
  // Mirrors the Email OTP flow above exactly (bcrypt-hashed storage, resend
  // cooldown, never-exposed plaintext), gated behind SmsService.isConfigured()
  // the same way Razorpay/email are gated elsewhere in this codebase - the
  // feature is fully wired and ready to go live the moment real Twilio
  // credentials are set, but every call is a safe no-op until then.
  //
  // Reuses the VerificationToken table (type = 'mobile_otp') rather than a
  // dedicated table: its `email` column is just a plain string identifier
  // column with no email-specific constraint, so it doubles as the
  // normalized-phone-number key here without a schema change.

  /**
   * Generate a 6-digit numeric OTP, bcrypt-hash it, store it in the
   * VerificationToken table (type = 'mobile_otp'), and SMS it.
   * Re-sends are rate-limited the same way sendEmailOtp is.
   */
  async sendMobileOtp(phoneNumber: string): Promise<{ message: string }> {
    const phone = this.normalizePhone(phoneNumber);

    const existing = await this.prisma.verificationToken.findFirst({
      where: { email: phone, type: 'mobile_otp' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      const elapsedMs = Date.now() - existing.createdAt.getTime();
      if (elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
        throw new BadRequestException(
          `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new code.`,
        );
      }
    }

    const user = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });

    // Don't reveal whether an account exists — identical response either way.
    if (!user) {
      return { message: 'If an account exists for this mobile number, a verification code has been sent.' };
    }

    if (user.phoneVerified) {
      return { message: 'Mobile number is already verified.' };
    }

    const otp = (crypto.randomInt(0, 1_000_000)).toString().padStart(OTP_DIGITS, '0');
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + MOBILE_OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.verificationToken.deleteMany({ where: { email: phone, type: 'mobile_otp' } });
    await this.prisma.verificationToken.create({
      data: { email: phone, token: otpHash, type: 'mobile_otp', expiresAt },
    });

    // Send SMS (non-blocking — SmsService.send never throws)
    this.smsService?.sendMobileOtp(phone, otp, MOBILE_OTP_EXPIRY_MINUTES).catch(() => undefined);

    return { message: 'Verification code sent. Please check your SMS messages.' };
  }

  /**
   * Verify a 6-digit mobile OTP. On success marks phoneVerified and deletes the token.
   */
  async verifyMobileOtp(phoneNumber: string, otp: string): Promise<{ message: string }> {
    const phone = this.normalizePhone(phoneNumber);

    const tokenRow = await this.prisma.verificationToken.findFirst({
      where: { email: phone, type: 'mobile_otp' },
    });

    if (!tokenRow) {
      throw new BadRequestException('No pending verification code found. Please request a new one.');
    }

    if (tokenRow.expiresAt < new Date()) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new BadRequestException('Verification code has expired. Please request a new one.');
    }

    if (tokenRow.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });
      throw new BadRequestException('Too many incorrect attempts. Please request a new verification code.');
    }

    const isValid = await bcrypt.compare(otp.trim(), tokenRow.token);

    if (!isValid) {
      await this.prisma.verificationToken.update({
        where: { id: tokenRow.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Incorrect verification code. Please try again.');
    }

    const user = await this.prisma.user.findFirst({ where: { phoneNumber: phone } });
    if (!user) {
      throw new BadRequestException('No account found for this mobile number.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { phoneVerified: new Date() },
    });
    await this.prisma.verificationToken.delete({ where: { id: tokenRow.id } });

    return { message: 'Mobile number verified successfully.' };
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
