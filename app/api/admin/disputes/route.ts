import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import '@/models/Ward';
import '@/models/Agency';
import '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin'], req);
    await connectToDatabase();

    const disputedComplaints = await Complaint.find({
      status: 'Disputed - Admin Review',
    })
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName')
      .populate('reportedBy', 'name email image')
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      count: disputedComplaints.length,
      complaints: disputedComplaints,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
