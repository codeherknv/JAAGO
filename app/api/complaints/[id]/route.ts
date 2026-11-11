import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import '@/models/Ward';
import '@/models/Agency';
import '@/models/User';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const complaint = await Complaint.findById(params.id)
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName jurisdictionCategories')
      .populate('reportedBy', 'name email image')
      .populate('statusHistory.actorId', 'name email role image')
      .lean();

    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    return NextResponse.json({ complaint });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve complaint', details: error.message },
      { status: 500 }
    );
  }
}
