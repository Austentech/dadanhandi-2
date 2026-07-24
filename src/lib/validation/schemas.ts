import { z } from 'zod/v4';

// Email validation schema
export const emailSchema = z.email('Please enter a valid email address');

// OTP validation schema (6 digits - Supabase native)
export const otpSchema = z
  .string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits');

// Registration schema
export const registerSchema = z.object({
  full_name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(80, 'Name must be at most 80 characters')
    .regex(/^[a-zA-Z\s.\-']*$/, 'Name can only contain letters, spaces, dots, hyphens, and apostrophes'),
  email: z.email('Please enter a valid email address'),
  whatsapp_number: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'WhatsApp number must be a valid 10-digit Indian mobile number')
    .describe('Required - Indian 10-digit number starting with 6-9'),
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
});

export type RegisterFormData = z.infer<typeof registerSchema>;

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
