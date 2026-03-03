import { z } from 'zod';

export const reviewCreateSchema = z.object({
  place_id: z.string().uuid(),
  dish_name: z.string().min(2).max(120),
  rating: z.number().int().min(1).max(5),
  taste_rating: z.number().int().min(1).max(5).optional(),
  price_rating: z.number().int().min(1).max(5).optional(),
  portion_rating: z.number().int().min(1).max(5).optional(),
  text: z.string().min(40).max(2000),
  photo_ids: z.array(z.string().uuid()).max(6).default([])
});

export const placeSearchSchema = z.object({
  q: z.string().max(120).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(100).max(25000).default(3000)
});

export const uploadInitiateSchema = z.object({
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.number().int().positive().max(8 * 1024 * 1024)
});

export const reportCreateSchema = z.object({
  target_type: z.enum(['review', 'photo', 'user', 'place']),
  target_id: z.string().uuid(),
  reason: z.string().min(4).max(200),
  details: z.string().max(2000).optional()
});

export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;
