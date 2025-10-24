import { z } from 'zod'

// ============================================
// Auth Validation Schemas
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(15, 'Password must be at most 15 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      'Password must contain at least one special character'
    ),
  name: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
})

// ============================================
// Trading Validation Schemas
// ============================================

export const orderSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  side: z.enum(['buy', 'sell'], {
    errorMap: () => ({ message: 'Side must be either "buy" or "sell"' }),
  }),
  volume: z.number().positive('Volume must be positive'),
  orderType: z.enum(['market', 'limit', 'stop'], {
    errorMap: () => ({ message: 'Invalid order type' }),
  }),
  price: z.number().positive('Price must be positive').optional(),
  stopLoss: z.number().positive('Stop loss must be positive').optional(),
  takeProfit: z.number().positive('Take profit must be positive').optional(),
  accountId: z.string().min(1, 'Account ID is required'),
})

export const closePositionSchema = z.object({
  positionId: z.union([z.string(), z.number()]),
  volume: z.number().positive().optional(),
  price: z.number().positive().optional(),
  comment: z.string().max(255).optional(),
})

// ============================================
// Market Data Validation Schemas
// ============================================

export const marketDataQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(10000).default(100),
  category: z
    .enum(['forex', 'crypto', 'stocks', 'indices', 'commodities', 'all'])
    .optional(),
  search: z.string().max(50).optional(),
})

// ============================================
// User Profile Validation Schemas
// ============================================

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
    .optional(),
  country: z.string().length(2, 'Country code must be 2 characters').optional(),
})

// ============================================
// Pagination Validation Schema
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================
// Validation Helper Function
// ============================================

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; errors: Array<{ field: string; message: string }> } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      }
    }
    throw error
  }
}

// ============================================
// Type Exports
// ============================================

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type OrderInput = z.infer<typeof orderSchema>
export type ClosePositionInput = z.infer<typeof closePositionSchema>
export type MarketDataQuery = z.infer<typeof marketDataQuerySchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type PaginationInput = z.infer<typeof paginationSchema>

