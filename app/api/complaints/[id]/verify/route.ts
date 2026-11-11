import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireAuth, formatApiError } from '@/lib/apiAuth';
import { verifyComplaintSchema, ObjectIdSchema } from '@/lib/validations';
import { calculatePriorityScore } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const caller = await requireAuth();
    const complaintId = ObjectIdSchema.parse(params.id);

    const body = await req.json();
    const { action, remarks, imageUrl } = verifyComplaintSchema.parse(body);

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

    if (action === 'confirm') {
      // Citizen verifies resolution
      complaint.status = 'Resolved - Citizen Verified';
      complaint.statusHistory.push({
        status: 'Resolved - Citizen Verified',
        actorId: caller.id as any,
        role: caller.role,
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
      // Invariant 5: 5-Day Citizen Audit & Dispute Circuit Breaker
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
        actorId: caller.id as any,
        role: caller.role,
        timestamp: new Date(),
        remarks: auditRemark,
        imageUrl: imageUrl || undefined,
      });

      // Recalculate priority score with higher reopen weight
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
    return formatApiError(error);
  }
}
