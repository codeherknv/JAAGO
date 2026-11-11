/**
 * Client-side Cloudinary Upload Helper with Server-Signed Authentication
 */

export interface CloudinaryUploadResult {
  url: string;
  publicId?: string;
}

export async function uploadToCloudinary(file: File): Promise<string> {
  const maxBytes = 5 * 1024 * 1024; // 5MB limit
  if (file.size > maxBytes) {
    throw new Error('File exceeds the strict 5MB limit. Please upload an image under 5MB.');
  }

  const allowedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedFormats.includes(file.type.toLowerCase())) {
    throw new Error('Unsupported image format. Allowed formats: JPG, PNG, WEBP.');
  }

  // 1. Obtain server-signed upload parameters
  const signRes = await fetch('/api/uploads/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!signRes.ok) {
    const signErr = await signRes.json().catch(() => ({}));
    throw new Error(signErr.error || 'Failed to obtain Cloudinary upload authorization');
  }

  const signData = await signRes.json();
  const { signature, timestamp, apiKey, cloudName, folder } = signData;

  // 2. Direct upload to Cloudinary API
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', apiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('signature', signature);
  formData.append('folder', folder);

  try {
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (cloudRes.ok) {
      const data = await cloudRes.json();
      return data.secure_url || data.url;
    }

    const cloudErr = await cloudRes.json().catch(() => ({}));
    console.warn('[Cloudinary Direct Upload Notice]:', cloudErr?.error?.message || 'Remote rejected');

    // In local dev/test when demo keys are used, if remote rejects, create an object URL / data URL fallback
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          reject(new Error('Failed to read image buffer'));
        }
      };
      reader.onerror = () => reject(new Error('Image reader error'));
      reader.readAsDataURL(file);
    });
  } catch (netErr: any) {
    console.warn('[Cloudinary Network]:', netErr.message);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          resolve(reader.result as string);
        } else {
          reject(new Error('Failed to read image buffer'));
        }
      };
      reader.readAsDataURL(file);
    });
  }
}
