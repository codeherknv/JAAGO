import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleAutoClose(req);
}

export async function POST(req: NextRequest) {
  return handleAutoClose(req);
}

async function handleAutoClose(req: NextRequest) {
  try {
    await connectToDatabase();
    const now = new Date();

    // 1. Resolve system user for audit log
    let systemUser = await User.findOne({ email: 'system.audit@jaago.in' });
    if (!systemUser) {
      systemUser = await User.create({
        name: 'Jaago Automated Audit Daemon',
        email: 'system.audit@jaago.in',
        role: 'admin',
      });
    }

    // 2. Query complaints in 'Pending Verification' whose 120-hour window has expired
    const expiredComplaints = await Complaint.find({
      status: 'Pending Verification',
      verificationDeadline: { $lte: now },
    });

    const updatedIds: string[] = [];

    for (const complaint of expiredComplaints) {
      complaint.status = 'Resolved - Auto Closed';
      complaint.statusHistory.push({
        status: 'Resolved - Auto Closed',
        actorId: systemUser._id,
        role: 'system',
        timestamp: now,
        remarks:
          '120-hour citizen verification window elapsed without citizen contest. Automatically transitioned to Resolved - Auto Closed.',
      });

      await complaint.save();
      updatedIds.push(complaint._id.toString());
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      closedCount: updatedIds.length,
      autoClosedComplaintIds: updatedIds,
      message: `Processed 120h auto-close audit: ${updatedIds.length} complaint(s) transitioned to Resolved - Auto Closed.`,
    });
  } catch (error: any) {
    console.error('Error during auto-close cron:', error);
    return NextResponse.json(
      { error: 'Auto-close worker failed', details: error.message },
      { status: 500 }
    );
  }
}
