import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Ward } from '@/models/Ward';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    const wards = await Ward.find({}, 'name code corporation boundary')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ wards });
  } catch (error: any) {
    console.error('[GET /api/wards Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch wards' },
      { status: 500 }
    );
  }
}
