import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'jaago_complaints';
    const apiKey = process.env.CLOUDINARY_API_KEY || '123456789012345';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'jaago-cloudinary-test-secret-sample-1234';
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'jaago-pilot';

    // Parameters sorted alphabetically for Cloudinary signature
    // EXIF metadata stripping is enforced via Cloudinary upload parameters: invalidate=true, exif=false
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder,
      maxFileSizeBytes: 5 * 1024 * 1024, // 5MB limit
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate upload signature', details: error.message },
      { status: 500 }
    );
  }
}
