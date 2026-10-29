// Zod validation schemas (used for runtime validation in frontend and API)

import { z } from 'zod';

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type Login = z.infer<typeof LoginSchema>;

export const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    name: z.string().min(2, 'Name must be at least 2 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type Register = z.infer<typeof RegisterSchema>;

// Product schemas
export const ProductFilterSchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  size: z.string().optional(),
  page: z.number().default(1),
  limit: z.number().default(20),
});

export type ProductFilter = z.infer<typeof ProductFilterSchema>;
