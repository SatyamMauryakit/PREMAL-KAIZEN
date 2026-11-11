import { Controller, Post, Get, Body, Request, Res, UseGuards, BadRequestException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IdentityService } from './identity.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { PermissionGuard } from '../common/rbac/permission.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { isAdminRole } from '../common/rbac/permissions';

/**
 * IdentityController
 * REST API endpoints for authentication
 */
@Controller('api/auth')
export class IdentityController {
  constructor(private identityService: IdentityService) { }

  /**
   * POST /api/auth/register
   * Register new customer
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() body: { email: string; password: string; firstName?: string; lastName?: string; phoneNumber?: string },
    @Res() res: Response,
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.identityService.register(body.email, body.password, body.firstName, body.lastName, body.phoneNumber);

    return res.json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user,
    });
  }

  /**
   * GET /api/auth/admin/exists
   * Public, non-sensitive check used by the admin signup page to decide
   * whether to show the first-admin bootstrap form or the "ask an admin" message.
   */
  @Get('admin/exists')
  async adminExists(@Res() res: Response) {
    const exists = await this.identityService.adminExists();
    return res.json({ exists });
  }

  /**
   * POST /api/auth/admin/bootstrap
   * Create the first administrator. Self-disables once an admin exists,
   * so this is safe to expose without authentication.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('admin/bootstrap')
  async bootstrapFirstAdmin(
    @Body() body: { email: string; password: string; firstName?: string; lastName?: string },
    @Res() res: Response,
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.identityService.bootstrapFirstAdmin(body.email, body.password, body.firstName, body.lastName);
    const session = await this.identityService.login(body.email, body.password);
    if ('requiresOtp' in session) {
      // Admin accounts always bypass the login-OTP step (see IdentityService.login) -
      // this branch should be unreachable for a just-created admin, but fail loudly
      // rather than silently mis-typing the response if that ever changes.
      throw new Error('Unexpected OTP requirement for a newly bootstrapped admin account');
    }

    res.cookie('sessionToken', session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, user, sessionToken: session.sessionToken });
  }

  /**
   * POST /api/auth/admin/create
   * Create an additional administrator. Requires admins:manage (SUPER_ADMIN only).
   */
  @UseGuards(AuthGuard, AdminGuard, PermissionGuard)
  @RequirePermission('admins:manage')
  @Post('admin/create')
  async createAdmin(
    @Body() body: { email: string; password: string; firstName?: string; lastName?: string; adminRole?: string },
    @Request() req: any,
    @Res() res: Response,
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }
    if (!body.adminRole || !isAdminRole(body.adminRole)) {
      throw new BadRequestException('A valid adminRole is required');
    }

    const user = await this.identityService.createAdmin(
      body.email,
      body.password,
      body.firstName,
      body.lastName,
      body.adminRole,
      { id: req.user.id, email: req.user.email, adminRole: req.user.adminRole },
    );
    return res.json({ success: true, user });
  }

  /**
   * POST /api/auth/login
   * Step 1 of the mandatory login flow: validates credentials. For a
   * customer account this NEVER returns a session - only `requiresOtp: true`,
   * once a fresh login OTP has been emailed. A session/cookie is only ever
   * issued by POST /login/verify-otp below (or immediately for admin
   * accounts, which are exempt from this step - see IdentityService.login).
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res() res: Response) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const result = await this.identityService.login(body.email, body.password);

    if ('requiresOtp' in result) {
      return res.json({ success: true, requiresOtp: true, email: result.email, message: result.message });
    }

    // Admin accounts only (see IdentityService.login) - session issued directly.
    res.cookie('sessionToken', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    return res.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      sessionToken: result.sessionToken, // Also return in body for client-side storage
    });
  }

  /**
   * POST /api/auth/login/verify-otp
   * Step 4-6 of the mandatory login flow. This is the only endpoint that can
   * ever issue a session/cookie for a customer account - a correct password
   * alone (POST /login above) never does.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login/verify-otp')
  async verifyLoginOtp(@Body() body: { email: string; otp: string }, @Res() res: Response) {
    if (!body.email || !body.otp) {
      throw new BadRequestException('email and otp are required');
    }

    const result = await this.identityService.verifyLoginOtp(body.email, body.otp);

    res.cookie('sessionToken', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: 'Login successful',
      user: result.user,
      sessionToken: result.sessionToken,
    });
  }

  /**
   * POST /api/auth/login/resend-otp
   * Explicit "resend" action for the login-OTP step. Only sends a fresh code
   * when a login OTP is already pending for this email (see
   * IdentityService.resendLoginOtp) - never a password-free way to trigger a send.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login/resend-otp')
  async resendLoginOtp(@Body() body: { email: string }, @Res() res: Response) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    const result = await this.identityService.resendLoginOtp(body.email);
    return res.json({ success: true, message: result.message });
  }

  /**
   * POST /api/auth/logout
   * Logout customer
   */
  @Post('logout')
  async logout(@Request() req: any, @Res() res: Response) {
    const sessionToken = req.cookies.sessionToken || req.headers.authorization?.replace('Bearer ', '');

    if (sessionToken) {
      await this.identityService.logout(sessionToken);
    }

    res.clearCookie('sessionToken');

    return res.json({
      success: true,
      message: 'Logout successful',
    });
  }

  /**
   * GET /api/auth/me
   * Get current user
   */
  @Get('me')
  async getCurrentUser(@Request() req: any, @Res() res: Response) {
    const sessionToken = req.cookies.sessionToken || req.headers.authorization?.replace('Bearer ', '');

    if (!sessionToken) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const user = await this.identityService.validateSession(sessionToken);

    if (!user) {
      res.clearCookie('sessionToken');
      return res.status(401).json({
        success: false,
        message: 'Session expired',
      });
    }

    return res.json({
      success: true,
      user,
    });
  }

  /**
   * POST /api/auth/verify-email
   * Verify email with token
   */
  @Post('verify-email')
  async verifyEmail(@Body() body: { token: string }, @Res() res: Response) {
    if (!body.token) {
      throw new BadRequestException('Verification token is required');
    }

    const result = await this.identityService.verifyEmail(body.token);

    return res.json({
      success: true,
      message: result.message,
    });
  }

  /**
   * POST /api/auth/request-password-reset
   * Request password reset email
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('request-password-reset')
  async requestPasswordReset(@Body() body: { email: string }, @Res() res: Response) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }

    const result = await this.identityService.requestPasswordReset(body.email);

    return res.json({
      success: true,
      message: result.message,
    });
  }

  /**
   * POST /api/auth/reset-password
   * Reset password with token
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; newPassword: string }, @Res() res: Response) {
    if (!body.token || !body.newPassword) {
      throw new BadRequestException('Token and new password are required');
    }

    const result = await this.identityService.resetPassword(body.token, body.newPassword);

    return res.json({
      success: true,
      message: result.message,
    });
  }

  /**
   * POST /api/auth/send-otp
   * Request a new email verification OTP (or re-send one).
   * Rate-limited: 5 requests per minute per IP; the service also enforces a
   * per-email cooldown of 60 seconds between consecutive sends.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-otp')
  async sendOtp(@Body() body: { email: string }, @Res() res: Response) {
    if (!body.email) {
      throw new BadRequestException('Email is required');
    }
    const result = await this.identityService.sendEmailOtp(body.email);
    return res.json({ success: true, message: result.message });
  }

  /**
   * POST /api/auth/verify-otp
   * Verify a 6-digit email OTP. Rate-limited to prevent brute-force.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; otp: string }, @Res() res: Response) {
    if (!body.email || !body.otp) {
      throw new BadRequestException('email and otp are required');
    }
    const result = await this.identityService.verifyEmailOtp(body.email, body.otp);
    return res.json({ success: true, message: result.message });
  }

  /**
   * POST /api/auth/send-mobile-otp
   * Request a new mobile verification OTP (or re-send one). A safe no-op until
   * a real SMS provider is configured (see SmsService) - never fails loudly.
   */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-mobile-otp')
  async sendMobileOtp(@Body() body: { phoneNumber: string }, @Res() res: Response) {
    if (!body.phoneNumber) {
      throw new BadRequestException('Phone number is required');
    }
    const result = await this.identityService.sendMobileOtp(body.phoneNumber);
    return res.json({ success: true, message: result.message });
  }

  /**
   * POST /api/auth/verify-mobile-otp
   * Verify a 6-digit mobile OTP. Rate-limited to prevent brute-force.
   */
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-mobile-otp')
  async verifyMobileOtp(@Body() body: { phoneNumber: string; otp: string }, @Res() res: Response) {
    if (!body.phoneNumber || !body.otp) {
      throw new BadRequestException('phoneNumber and otp are required');
    }
    const result = await this.identityService.verifyMobileOtp(body.phoneNumber, body.otp);
    return res.json({ success: true, message: result.message });
  }
}
