import { Controller, Post, Get, Body, Request, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { IdentityService } from './identity.service';

/**
 * IdentityController
 * REST API endpoints for authentication
 */
@Controller('api/auth')
export class IdentityController {
  constructor(private identityService: IdentityService) {}

  /**
   * POST /api/auth/register
   * Register new customer
   */
  @Post('register')
  async register(
    @Body() body: { email: string; password: string; firstName?: string; lastName?: string },
    @Res() res: Response,
  ) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const user = await this.identityService.register(body.email, body.password, body.firstName, body.lastName);

    return res.json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user,
    });
  }

  /**
   * POST /api/auth/login
   * Login customer
   */
  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res() res: Response) {
    if (!body.email || !body.password) {
      throw new BadRequestException('Email and password are required');
    }

    const result = await this.identityService.login(body.email, body.password);

    // Set secure HTTP-only cookie with session token
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
}
