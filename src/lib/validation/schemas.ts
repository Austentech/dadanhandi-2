import { z } from 'zod/v4';

// Email validation schema
export const emailSchema = z.email('Please enter a valid email address');

// Password validation schema (strong password requirements)
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (@, #, $, etc.)');

// Login schema (email + password)
export const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

// Registration schema (all fields + password + confirm password)
export const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(3, 'Name must be at least 3 characters')
      .max(80, 'Name must be at most 80 characters')
      .regex(/^[a-zA-Z\s.\-']*$/, 'Name can only contain letters, spaces, dots, hyphens, and apostrophes'),
    email: z.email('Please enter a valid email address'),
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
    whatsapp_number: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'WhatsApp number must be a valid 10-digit Indian mobile number'),
    mobile_number: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian mobile number')
      .optional()
      .or(z.literal('')),
    area: z
      .string()
      .min(2, 'Area must be at least 2 characters')
      .max(100, 'Area must be at most 100 characters'),
    city: z
      .string()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City must be at most 100 characters'),
    pincode: z
      .string()
      .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

// Forgot password schema (email only)
export const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// Reset password schema (new password + confirm)
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirm_password: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// Profile completion schema (for Google users)
export const completeProfileSchema = z.object({
  whatsapp_number: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'WhatsApp number must be a valid 10-digit Indian mobile number'),
  area: z
    .string()
    .min(2, 'Area must be at least 2 characters')
    .max(100, 'Area must be at most 100 characters'),
  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be at most 100 characters'),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits'),
});

export type CompleteProfileFormData = z.infer<typeof completeProfileSchema>;

// Profile update schema
export const updateProfileSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(80, 'Name must be at most 80 characters')
    .optional(),
  whatsapp_number: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'WhatsApp number must be a valid 10-digit Indian mobile number')
    .nullable()
    .optional(),
  mobile_number: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Mobile number must be a valid 10-digit Indian mobile number')
    .nullable()
    .optional(),
  area: z
    .string()
    .min(2, 'Area must be at least 2 characters')
    .max(100, 'Area must be at most 100 characters')
    .nullable()
    .optional(),
  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be at most 100 characters')
    .nullable()
    .optional(),
  pincode: z
    .string()
    .regex(/^\d{6}$/, 'Pincode must be exactly 6 digits')
    .nullable()
    .optional(),
});

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;
