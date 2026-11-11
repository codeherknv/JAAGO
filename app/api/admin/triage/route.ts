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

    const unassignedComplaints = await Complaint.find({
      $or: [{ wardId: null }, { agencyId: null }, { wardId: { $exists: false } }, { agencyId: { $exists: false } }],
    })
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName')
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      count: unassignedComplaints.length,
      complaints: unassignedComplaints,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
