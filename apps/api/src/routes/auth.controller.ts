import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { users } from '@spare-parts/db/src/schema/iam';
import { eq } from 'drizzle-orm';
import { Request } from 'express';
import { z } from 'zod';

import { AuthService } from '../auth/auth.service';
import { signAccessToken } from '../auth/jwt';
import { JwtGuard } from '../auth/jwt.guard';
import { Public } from '../auth/public.decorator';
import { rotateRefreshToken, revokeRefreshToken } from '../auth/refresh';
import { db } from '../db';

const RegisterDto = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).optional(),
  password: z.string().min(8),
  tenantId: z.string().uuid().optional(),
});

const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantId: z.string().uuid().optional(),
});

const RefreshDto = z.object({
  refreshToken: z.string().min(10),
});

@Controller('auth')
export class AuthController {
  @Public()
  @Post('register')
  async register(@Body() body: unknown) {
    const dto = RegisterDto.parse(body);
    const { access_token, user, tenantId } = await AuthService.register(
      dto.email,
      dto.fullName,
      dto.password,
      dto.tenantId,
    );

    // also issue a refresh token
    const { issueRefreshToken } = await import('../auth/refresh');
    const rt = await issueRefreshToken(user.id, tenantId);
    return {
      access_token,
      refresh_token: rt.refreshToken,
      refresh_expires_at: rt.expiresAt,
      user,
      tenantId,
    };
  }

  @Public()
  @Post('login')
  async login(@Body() body: unknown) {
    const dto = LoginDto.parse(body);
    const { access_token, user, tenantId } = await AuthService.login(
      dto.email,
      dto.password,
      dto.tenantId,
    );

    const { issueRefreshToken } = await import('../auth/refresh');
    const rt = await issueRefreshToken(user.id, tenantId);
    return {
      access_token,
      refresh_token: rt.refreshToken,
      refresh_expires_at: rt.expiresAt,
      user,
      tenantId,
    };
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const dto = RefreshDto.parse(body);
    const rotated = await rotateRefreshToken(dto.refreshToken);
    if (!rotated) return { ok: false, error: 'invalid_or_expired_refresh' };

    const [u] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, rotated.userId))
      .limit(1);

    const access_token = signAccessToken({
      sub: rotated.userId,
      tenantId: rotated.tenantId,
      email: u?.email ?? '',
    });

    return {
      ok: true,
      access_token,
      refresh_token: rotated.refreshToken,
      refresh_expires_at: rotated.expiresAt,
    };
  }

  @Public()
  @Post('logout')
  async logout(@Body() body: unknown) {
    const dto = RefreshDto.parse(body);
    await revokeRefreshToken(dto.refreshToken);
    return { ok: true };
  }

  // Simple identity endpoint powered by JWT
  @Get('/me')
  @UseGuards(JwtGuard)
  me(@Req() req: Request) {
    return {
      ok: true,
      userId: req.user?.userId,
      tenantId: req.user?.tenantId,
      email: req.user?.email,
    };
  }
}
