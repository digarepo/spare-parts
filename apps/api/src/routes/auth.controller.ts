import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';

import { AuthService } from '../auth/auth.service';

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

@Controller('auth')
export class AuthController {
  @Post('register')
  async register(@Body() body: unknown) {
    const dto = RegisterDto.parse(body);
    return AuthService.register(dto.email, dto.fullName, dto.password, dto.tenantId);
  }

  @Post('login')
  async login(@Body() body: unknown) {
    const dto = LoginDto.parse(body);
    return AuthService.login(dto.email, dto.password, dto.tenantId);
  }
}
