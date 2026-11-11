import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Ward } from '@/models/Ward';
import { Agency } from '@/models/Agency';
import { requireRole, formatApiError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin'], req);
    await connectToDatabase();

    const [wards, agencies] = await Promise.all([
      Ward.find({}, 'name code corporation').sort({ code: 1 }).lean(),
      Agency.find({}, 'name shortName jurisdictionCategories').sort({ shortName: 1 }).lean(),
    ]);

    return NextResponse.json({ wards, agencies });
  } catch (error: any) {
    return formatApiError(error);
  }
}
