import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint, ComplaintStatus } from '@/models/Complaint';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { arbitrateDisputeSchema, ObjectIdSchema } from '@/lib/validations';
import { sendNotification } from '@/lib/notifications';
import '@/models/Ward';
import '@/models/Agency';

export const dynamic = 'force-dynamic';

async function handleArbitrate(
  req: NextRequest,
  params: { id: string }
) {
  try {
    const admin = await requireRole(['admin'], req);
    const complaintId = ObjectIdSchema.parse(params.id);

    const body = await req.json();
    const validated = arbitrateDisputeSchema.parse(body);
    const { action, remarks } = validated;

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (complaint.status !== 'Disputed - Admin Review') {
      return NextResponse.json(
        { error: `Complaint is in '${complaint.status}' status, not 'Disputed - Admin Review'.` },
        { status: 400 }
      );
    }

    const newStatus: ComplaintStatus =
      action === 'resolve' ? 'Resolved - Citizen Verified' : 'Rejected - Invalid';

    complaint.status = newStatus;
    complaint.verificationDeadline = undefined;

    // Invariant 7: Append-Only Audit for Admin Dispute Arbitration
    complaint.statusHistory.push({
      status: newStatus,
      actorId: admin.id as any,
      role: 'admin',
      timestamp: new Date(),
      remarks: `[Admin Arbitration - ${action.toUpperCase()}]: ${remarks}`,
    });

    await complaint.save();

    // Notify citizen reporter
    try {
      await sendNotification({
        userId: complaint.reportedBy.toString(),
        complaintId: complaint._id,
        type: 'status_update',
        title:
          action === 'resolve'
            ? 'Dispute Arbitrated: Complaint Upheld and Marked Resolved'
            : 'Dispute Arbitrated: Complaint Marked Rejected - Invalid',
        message: `Admin review concluded: "${complaint.title}". Decision: ${action === 'resolve' ? 'Resolution Upheld' : 'Marked Invalid'}. Remarks: ${remarks}`,
      });
    } catch (notifErr: any) {
      console.warn('Failed to send dispute arbitration notification:', notifErr.message);
    }

    return NextResponse.json({
      message: `Dispute successfully arbitrated: marked as ${newStatus}`,
      complaint,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleArbitrate(req, params);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleArbitrate(req, params);
}
