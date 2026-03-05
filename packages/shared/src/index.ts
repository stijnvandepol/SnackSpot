import { z } from 'zod'

// ─── Re-usable primitives ────────────────────────────────────────────────────

export const CursorSchema = z.string().optional()

export const PaginationSchema = z.object({
  cursor: CursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── Auth schemas ────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores'),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ─── Place schemas ───────────────────────────────────────────────────────────

export const CreatePlaceSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const PlaceSearchSchema = z.object({
  q: z.string().max(200).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().int().min(100).max(50000).default(3000),
  cursor: CursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── Review schemas ──────────────────────────────────────────────────────────

export const CreateReviewSchema = z.object({
  placeId: z.string().min(1).optional(),
  place: CreatePlaceSchema.optional(),
  rating: z.number().int().min(1).max(5),
  text: z.string().min(10).max(2000),
  dishName: z.string().min(1).max(100).optional(),
  photoIds: z.array(z.string()).max(5).default([]),
})

export const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  text: z.string().min(10).max(2000).optional(),
  dishName: z.string().min(1).max(100).optional(),
})

export const ReviewsQuerySchema = z.object({
  sort: z.enum(['new', 'top']).default('new'),
  q: z.string().max(200).optional(),
  cursor: CursorSchema,
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

// ─── Photo schemas ───────────────────────────────────────────────────────────

export const InitiateUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence',
  ]),
  size: z.number().int().positive(),
})

export const ConfirmUploadSchema = z.object({
  photoId: z.string(),
  reviewId: z.string().optional(),
})

// ─── Report schemas ──────────────────────────────────────────────────────────

export const CreateReportSchema = z.object({
  targetType: z.enum(['REVIEW', 'PHOTO']),
  reviewId: z.string().optional(),
  photoId: z.string().optional(),
  reason: z.string().min(5).max(500),
})

// ─── Moderation schemas ──────────────────────────────────────────────────────

export const ModerationActionSchema = z.object({
  action: z.enum([
    'HIDE_REVIEW',
    'UNHIDE_REVIEW',
    'DELETE_REVIEW',
    'DELETE_PHOTO',
    'BAN_USER',
    'UNBAN_USER',
    'DISMISS_REPORT',
  ]),
  targetType: z.enum(['REVIEW', 'PHOTO', 'USER', 'REPORT']),
  targetId: z.string(),
  reportId: z.string().optional(),
  note: z.string().max(500).optional(),
})

// ─── Shared response types ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T
}

export interface ApiError {
  error: string
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    nextCursor: string | null
    hasMore: boolean
  }
}

// ─── Domain types (client-facing) ────────────────────────────────────────────

export interface UserPublic {
  id: string
  username: string
  avatarKey: string | null
  role: string
  createdAt: string
}

export interface PlaceSummary {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  avgRating: number | null
  reviewCount: number
  distance?: number
}

export interface PhotoVariants {
  thumb?: string
  medium?: string
  large?: string
}

export interface ReviewSummary {
  id: string
  rating: number
  text: string
  dishName: string | null
  status: string
  createdAt: string
  user: UserPublic
  place: PlaceSummary
  photos: Array<{ id: string; variants: PhotoVariants }>
}

export type z = typeof import('zod').z
