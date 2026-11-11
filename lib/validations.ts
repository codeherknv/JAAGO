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

/**
 * Server-Side Image Proof Validation:
 * Enforces allowed formats (JPG, PNG, WEBP) and strict 5MB size limit.
 * Supports Cloudinary URLs, standard HTTP(S) image links, and base64 data URIs.
 */
export const imageProofSchema = z
  .string()
  .trim()
  .min(1, 'Image URL or proof is required')
  .refine(
    (val) => {
      // 1. Data URI validation (e.g. offline/mock uploads or live camera buffers)
      if (val.startsWith('data:')) {
        const match = val.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i);
        if (!match) return false;
        const base64Data = match[3];
        // Base64 to byte size: 4 chars represent 3 bytes
        const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
        return sizeInBytes <= 5 * 1024 * 1024; // 5MB limit
      }

      // 2. HTTP/HTTPS URL validation
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
        const pathname = parsed.pathname.toLowerCase();
        const isCloudinary = parsed.hostname.includes('cloudinary.com');
        const hasAllowedExt = /\.(jpg|jpeg|png|webp)$/i.test(pathname);
        return isCloudinary || hasAllowedExt;
      } catch {
        return false;
      }
    },
    {
      message: 'Invalid image proof: Must be a valid JPG, PNG, or WEBP image under 5MB.',
    }
  );

export const createComplaintSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title cannot exceed 150 characters'),
  description: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  category: z.enum(COMPLAINT_CATEGORIES),
  lat: z.coerce.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90'),
  lng: z.coerce.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180'),
  address: z.string().trim().max(300).optional().default('Bengaluru'),
  imageUrl: imageProofSchema,
  confirmDistinct: z.boolean().optional().default(false),
});

export const resolveComplaintSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  accuracy: z.coerce.number().min(0, 'Accuracy must be positive'),
  resolutionImageUrl: imageProofSchema,
  remarks: z.string().trim().min(3, 'Resolution remarks must be at least 3 characters').max(1000),
});

export const updateStatusSchema = z.object({
  status: z.enum(['Pending', 'In Progress', 'Rejected - Invalid']),
  remarks: z.string().trim().max(500).optional(),
});

export const verifyComplaintSchema = z.object({
  action: z.enum(['confirm', 'contest']),
  remarks: z.string().trim().max(1000).optional(),
  imageUrl: imageProofSchema.optional(),
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

export const signUploadSchema = z
  .object({
    folder: z.string().trim().max(100).optional().default('jaago_complaints'),
  })
  .optional();

export const getUpvoteQuerySchema = z.object({
  userId: ObjectIdSchema.optional(),
});

export const cronQuerySchema = z.object({
  dryRun: z.coerce.boolean().optional().default(false),
});
