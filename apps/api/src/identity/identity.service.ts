import { Injectable, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { maskEmail } from '../common/logging/redact';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 10;

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
  constructor(private prisma: PrismaService) {}

  /**
   * Register a new customer account
   * @param email - Customer email
   * @param password - Plain text password (will be hashed)
   * @param firstName - First name
   * @param lastName - Last name
   * @returns User object (without password)
   */
  async register(email: string, password: string, firstName?: string, lastName?: string) {
    const user = await this.createUser(email, password, firstName, lastName, 'customer');
    await this.createVerificationToken(user.email, 'email_verification');
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
    return this.createUser(email, password, firstName, lastName, 'admin');
  }

  /**
   * Create an additional administrator. Caller must already be authenticated
   * as an admin (enforced by AuthGuard + AdminGuard on the controller route).
   */
  async createAdmin(email: string, password: string, firstName?: string, lastName?: string) {
    return this.createUser(email, password, firstName, lastName, 'admin');
  }

  private async createUser(
    email: string,
    password: string,
    firstName: string | undefined,
    lastName: string | undefined,
    role: 'customer' | 'admin'
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
        firstName: firstName || null,
        lastName: lastName || null,
        emailVerified: role === 'admin' ? new Date() : null,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Login user
   * @param email - User email
   * @param password - Plain text password
   * @returns Session token
   */
  async login(email: string, password: string) {
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

    // Create session
    const session = await this.createSession(user.id);

    // Update last login
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
        emailVerified: user.emailVerified,
      },
    };
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
    await this.createVerificationToken(user.email, 'password_reset');

    // TODO: Send email with reset token
    // For now, in development mode, log the token
    console.log(`[DEV] Password reset requested for ${maskEmail(email)} - token stored in database, not logged`);

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
