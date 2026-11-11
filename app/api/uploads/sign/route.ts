import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { signUploadSchema } from '@/lib/validations';
import { formatApiError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    let folder = 'jaago_complaints';

    // 1. Zod validate optional request body if provided
    try {
      const text = await req.text();
      if (text && text.trim().length > 0) {
        const json = JSON.parse(text);
        const validated = signUploadSchema?.parse(json);
        if (validated?.folder) {
          folder = validated.folder;
        }
      }
    } catch (parseErr) {
      // If parsing fails, fall back to default validated folder
    }

    const isTest = process.env.NODE_ENV === 'test';
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    // In development and production, missing or invalid mock credentials return a clear error
    if (!isTest) {
      const isMissing = !apiKey || !apiSecret || !cloudName;
      const isPlaceholder =
        apiKey === '123456789012345' ||
        apiSecret === 'jaago-cloudinary-test-secret-sample-1234' ||
        apiSecret?.includes('sample') ||
        cloudName === 'demo-cloud';

      if (isMissing || isPlaceholder) {
        return NextResponse.json(
          {
            error:
              'Cloudinary configuration is missing or invalid. Set valid CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.',
          },
          { status: 500 }
        );
      }
    }

    // In test mode, fallback to mock credentials if not set
    const effectiveApiKey = apiKey || '123456789012345';
    const effectiveApiSecret = apiSecret || 'jaago-cloudinary-test-secret-sample-1234';
    const effectiveCloudName = cloudName || 'jaago-pilot';

    const timestamp = Math.round(new Date().getTime() / 1000);
    const allowedFormats = 'jpg,jpeg,png,webp';

    // Cloudinary signature parameters sorted alphabetically:
    // 1. allowed_formats, 2. folder, 3. timestamp
    const paramsToSign = `allowed_formats=${allowedFormats}&folder=${folder}&timestamp=${timestamp}${effectiveApiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return NextResponse.json({
      signature,
      timestamp,
      apiKey: effectiveApiKey,
      cloudName: effectiveCloudName,
      folder,
      allowed_formats: allowedFormats,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
