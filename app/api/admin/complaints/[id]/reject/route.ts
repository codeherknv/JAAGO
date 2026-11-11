import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { rejectComplaintSchema, ObjectIdSchema } from '@/lib/validations';
import { sendNotification } from '@/lib/notifications';
import '@/models/Ward';
import '@/models/Agency';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireRole(['admin'], req);
    const complaintId = ObjectIdSchema.parse(params.id);

    const body = await req.json();
    const validated = rejectComplaintSchema.parse(body);
    const { reason } = validated;

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    complaint.status = 'Rejected - Invalid';
    complaint.verificationDeadline = undefined;

    // Invariant 7: Append-Only Audit for Admin Invalidation
    complaint.statusHistory.push({
      status: 'Rejected - Invalid',
      actorId: admin.id as any,
      role: 'admin',
      timestamp: new Date(),
      remarks: `[Marked Rejected - Invalid by Admin]: ${reason}`,
    });

    await complaint.save();

    // Notify citizen reporter
    try {
      await sendNotification({
        userId: complaint.reportedBy.toString(),
        complaintId: complaint._id,
        type: 'status_update',
        title: 'Complaint Marked as Rejected - Invalid',
        message: `Your complaint "${complaint.title}" has been reviewed by Municipal Administration and marked as Rejected - Invalid. Reason: ${reason}`,
      });
    } catch (notifErr: any) {
      console.warn('Failed to send rejection notification:', notifErr.message);
    }

    return NextResponse.json({
      message: 'Complaint successfully marked as Rejected - Invalid',
      complaint,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
