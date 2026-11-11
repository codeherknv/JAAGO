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
 * - Accept only HTTPS URLs on res.cloudinary.com containing our cloud name and the jaago_complaints folder.
 * - Allow base64 data URIs only when NODE_ENV === 'test'.
 */
export const imageProofSchema = z
  .string()
  .trim()
  .min(1, 'Image URL or proof is required')
  .refine(
    (val) => {
      // 1. Data URI validation: allowed ONLY when NODE_ENV === 'test'
      if (val.startsWith('data:')) {
        if (process.env.NODE_ENV !== 'test') {
          return false;
        }
        const match = val.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/i);
        if (!match) return false;
        const base64Data = match[3];
        const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
        return sizeInBytes <= 5 * 1024 * 1024; // 5MB limit
      }

      // 2. HTTPS URL on res.cloudinary.com containing cloud name and jaago_complaints folder
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== 'https:') return false;
        if (parsed.hostname !== 'res.cloudinary.com') return false;

        const configuredCloud = (process.env.CLOUDINARY_CLOUD_NAME || 'jaago-pilot').toLowerCase();
        const validClouds = new Set([configuredCloud, 'jaago-pilot', 'demo-cloud']);

        // Split pathname: ['', '<cloud_name>', 'image', 'upload', ..., 'jaago_complaints', '...']
        const pathSegments = parsed.pathname.toLowerCase().split('/').filter(Boolean);
        if (pathSegments.length < 3) return false;

        const urlCloud = pathSegments[0];
        const hasValidCloud = validClouds.has(urlCloud);
        const hasFolder = parsed.pathname.includes('/jaago_complaints/');

        return hasValidCloud && hasFolder;
      } catch {
        return false;
      }
    },
    {
      message:
        'Invalid image proof: Must be a secure HTTPS Cloudinary URL on res.cloudinary.com matching our cloud name and jaago_complaints folder.',
    }
  );

/**
 * Strips on-the-fly Cloudinary transformation parameters from a delivery URL
 * to target the original uploaded asset for authoritative HEAD size/format checks.
 * E.g. https://res.cloudinary.com/cloud/image/upload/w_500,c_fill,q_auto/v12345/jaago_complaints/abc.jpg
 * -> https://res.cloudinary.com/cloud/image/upload/v12345/jaago_complaints/abc.jpg
 */
export function getOriginalCloudinaryUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'res.cloudinary.com') return url;

    const pathname = parsed.pathname;
    const uploadPrefix = '/image/upload/';
    const uploadIdx = pathname.indexOf(uploadPrefix);
    if (uploadIdx === -1) return url;

    const prefix = pathname.substring(0, uploadIdx + uploadPrefix.length);
    const remainder = pathname.substring(uploadIdx + uploadPrefix.length);

    // Asset identifier matches: optional version (v\d+/) followed by jaago_complaints/...
    const assetMatch = remainder.match(/((?:v\d+\/)?jaago_complaints\/.*)$/i);
    if (assetMatch) {
      parsed.pathname = prefix + assetMatch[1];
      parsed.search = '';
      return parsed.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Server-side asset size and format verifier for Cloudinary uploads:
 * In live/production/development, performs an HTTP HEAD request to the ORIGINAL asset URL on res.cloudinary.com.
 * Rejection conditions:
 * - HEAD request fails (non-2xx response or network error)
 * - Content-Length header is missing or invalid
 * - Content-Length exceeds 5MB (5 * 1024 * 1024 bytes)
 * For base64 data URIs (in test mode only), computes decoded byte size directly.
 */
export async function verifyCloudinaryAssetSize(url: string): Promise<boolean> {
  if (url.startsWith('data:')) {
    if (process.env.NODE_ENV !== 'test') return false;
    const base64Data = url.split(',')[1] || '';
    const sizeInBytes = Math.ceil((base64Data.length * 3) / 4);
    return sizeInBytes > 0 && sizeInBytes <= 5 * 1024 * 1024;
  }

  try {
    const originalUrl = getOriginalCloudinaryUrl(url);
    const res = await fetch(originalUrl, { method: 'HEAD' });
    if (!res.ok) {
      return false; // HEAD request failed (e.g. 404, 403, 500)
    }

    const contentLength = res.headers.get('content-length');
    if (!contentLength) {
      return false; // Content-Length header is missing
    }

    const bytes = parseInt(contentLength, 10);
    if (isNaN(bytes) || bytes <= 0 || bytes > 5 * 1024 * 1024) {
      return false; // Exceeds 5MB or invalid
    }

    return true;
  } catch {
    return false; // Network/fetch error: reject upload
  }
}

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

// Admin Schemas
export const addOfficerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  agencyId: ObjectIdSchema,
  assignedWardId: ObjectIdSchema,
  isActive: z.boolean().optional().default(true),
});

export const updateOfficerSchema = z.object({
  agencyId: ObjectIdSchema.optional(),
  assignedWardId: ObjectIdSchema.optional(),
  isActive: z.boolean().optional(),
});

export const assignComplaintSchema = z.object({
  wardId: ObjectIdSchema.optional(),
  agencyId: ObjectIdSchema.optional(),
  remarks: z.string().trim().max(500).optional(),
});

export const arbitrateDisputeSchema = z.object({
  action: z.enum(['resolve', 'reject']),
  remarks: z.string().trim().min(5, 'Detailed arbitration remarks are required (min 5 characters)').max(1000),
});

export const rejectComplaintSchema = z.object({
  reason: z.string().trim().min(5, 'Reason for invalidation must be at least 5 characters').max(1000),
});
