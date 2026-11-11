import { z } from 'zod';

export const COMPLAINT_CATEGORIES = [
  'Roads',
  'Sanitation',
  'Streetlights',
  'Water Supply & Drainage',
  'Others',
] as const;

export const COMPLAINT_STATUSES = [
  'Pending',
  'In Progress',
  'Pending Verification',
  'Resolved - Citizen Verified',
  'Resolved - Auto Closed',
  'Reopened - Escalated',
  'Disputed - Admin Review',
  'Rejected - Invalid',
] as const;

export const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId identifier');

export const createComplaintSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters').max(2000, 'Description cannot exceed 2000 characters'),
  category: z.enum(COMPLAINT_CATEGORIES),
  lat: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  address: z.string().trim().max(300).optional().default('Bengaluru'),
  imageUrl: z.string().min(1, 'Image URL or proof is required'),
  confirmDistinct: z.boolean().optional().default(false),
});

export const resolveComplaintSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0, 'Accuracy must be positive'),
  resolutionImageUrl: z.string().min(1, 'Resolution photo proof is required'),
  remarks: z.string().trim().min(3, 'Resolution remarks must be at least 3 characters').max(1000),
});

export const updateStatusSchema = z.object({
  status: z.enum(['Pending', 'In Progress', 'Rejected - Invalid']),
  remarks: z.string().trim().max(500).optional(),
});

export const verifyComplaintSchema = z.object({
  action: z.enum(['confirm', 'contest']),
  remarks: z.string().trim().max(1000).optional(),
  imageUrl: z.string().optional(),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  category: z.string().optional(),
  maxDistance: z.coerce.number().min(1).max(1000).optional().default(40),
});

export const listComplaintsQuerySchema = z.object({
  wardId: ObjectIdSchema.optional(),
  category: z.enum(COMPLAINT_CATEGORIES).optional(),
  status: z.enum(COMPLAINT_STATUSES).optional(),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
});
