import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireAuth, formatApiError } from '@/lib/apiAuth';
import '@/models/Ward';
import '@/models/Agency';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectToDatabase();

    // Query all complaints filed by the authenticated citizen
    // Note: unrouted complaints (wardId: null / undefined) are explicitly included so the citizen can track their status
    const complaints = await Complaint.find({ reportedBy: user.id })
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName')
      .sort({ createdAt: -1 })
      .lean();

    const formattedComplaints = complaints.map((c: any) => ({
      ...c,
      routingStatus: c.wardId ? 'Routed' : 'Waiting for routing',
    }));

    return NextResponse.json({
      count: formattedComplaints.length,
      complaints: formattedComplaints,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
