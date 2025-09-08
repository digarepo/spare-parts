import { z } from 'zod';

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  createdAt: z.string().datetime(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(190),
  fullName: z.string().max(160).nullish(),
  createdAt: z.string().datetime(),
});

export type Organization = z.infer<typeof OrganizationSchema>;
export type User = z.infer<typeof UserSchema>;
