import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { User } from '@/models/User';
import { calculatePriorityScore } from '@/lib/geo';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const complaintId = params.id;
    const body = await req.json();
    const { action, remarks, imageUrl } = body;

    if (!action || !['confirm', 'contest'].includes(action)) {
      return NextResponse.json(
        { error: "Valid action ('confirm' or 'contest') is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (complaint.status !== 'Pending Verification') {
      return NextResponse.json(
        {
          error: `Complaint is in '${complaint.status}' status, not 'Pending Verification'. Only pending verification complaints can be confirmed or contested.`,
        },
        { status: 400 }
      );
    }

    // Resolve user (from session or demo citizen)
    let actorUser;
    if (session?.user?.id) {
      actorUser = await User.findById(session.user.id);
    }
    if (!actorUser) {
      actorUser = await User.findById(complaint.reportedBy) || (await User.findOne({ role: 'citizen' }));
    }

    const actorId = actorUser ? actorUser._id : complaint.reportedBy;
    const actorRole = actorUser?.role || 'citizen';

    if (action === 'confirm') {
      // Citizen verifies resolution
      complaint.status = 'Resolved - Citizen Verified';
      complaint.statusHistory.push({
        status: 'Resolved - Citizen Verified',
        actorId,
        role: actorRole,
        timestamp: new Date(),
        remarks: remarks || 'Resolution confirmed and verified by citizen audit.',
      });

      await complaint.save();

      return NextResponse.json({
        message: 'Resolution confirmed successfully. Complaint marked as Resolved - Citizen Verified.',
        complaint,
      });
    }

    if (action === 'contest') {
      // Invariant 5: 5-Day Citizen Audit & Circuit Breaker
      // Reopens are capped at 2; the 3rd dispute moves the ticket to "Disputed - Admin Review"
      if (!remarks) {
        return NextResponse.json(
          { error: 'Detailed remarks/evidence are required when contesting a resolution.' },
          { status: 400 }
        );
      }

      const currentReopens = complaint.reopenCount || 0;
      let newStatus: any = 'Reopened - Escalated';
      let auditRemark = remarks;

      if (currentReopens >= 2) {
        // Circuit breaker tripped: 3rd dispute
        newStatus = 'Disputed - Admin Review';
        auditRemark = `[Circuit Breaker Tripped - Dispute #3] Escalated to Municipal Admin Review. Citizen feedback: ${remarks}`;
      } else {
        auditRemark = `[Dispute #${currentReopens + 1}] Reopened by citizen. Reason: ${remarks}`;
      }

      complaint.reopenCount = currentReopens + 1;
      complaint.status = newStatus;
      complaint.verificationDeadline = undefined; // clear pending verification window

      complaint.statusHistory.push({
        status: newStatus,
        actorId,
        role: actorRole,
        timestamp: new Date(),
        remarks: auditRemark,
        imageUrl: imageUrl || undefined,
      });

      // Recalculate priority with higher reopen weight
      complaint.priorityScore = calculatePriorityScore(
        complaint.category,
        complaint.upvotesCount,
        complaint.createdAt,
        complaint.reopenCount
      );

      await complaint.save();

      return NextResponse.json({
        message:
          newStatus === 'Disputed - Admin Review'
            ? 'Dispute limit reached (2 reopens). Ticket escalated to Disputed - Admin Review.'
            : `Resolution contested. Ticket reopened (Dispute #${complaint.reopenCount}).`,
        complaint,
        circuitBreakerTripped: newStatus === 'Disputed - Admin Review',
      });
    }
  } catch (error: any) {
    console.error('Error verifying complaint:', error);
    return NextResponse.json(
      { error: 'Failed to process verification', details: error.message },
      { status: 500 }
    );
  }
}
