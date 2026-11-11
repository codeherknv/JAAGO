import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { User } from '@/models/User';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const complaintId = params.id;
    const body = await req.json();
    const { status, remarks } = body;

    const allowedTransitions = [
      'In Progress',
      'Pending',
      'Rejected - Invalid',
    ];

    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        { error: `Invalid transition to status: ${status}. For resolution, use /resolve.` },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    let actorUser;
    if (session?.user?.id) {
      actorUser = await User.findById(session.user.id);
    }
    if (!actorUser) {
      actorUser = await User.findOne({ role: 'officer' }) || (await User.findOne());
    }

    complaint.status = status;
    complaint.statusHistory.push({
      status,
      actorId: actorUser!._id,
      role: actorUser?.role || 'officer',
      timestamp: new Date(),
      remarks: remarks || `Status changed to ${status}`,
    });

    await complaint.save();

    return NextResponse.json({
      message: `Status updated to ${status}`,
      complaint,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update status', details: error.message },
      { status: 500 }
    );
  }
}
