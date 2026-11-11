import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { User } from '@/models/User';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { assignComplaintSchema, ObjectIdSchema } from '@/lib/validations';
import { notifyAssignment } from '@/lib/notifications';
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
    const validated = assignComplaintSchema.parse(body);
    const { wardId, agencyId, remarks } = validated;

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    if (wardId) complaint.wardId = wardId as any;
    if (agencyId) complaint.agencyId = agencyId as any;

    // Invariant 7: Append-Only Audit for Admin Actions
    complaint.statusHistory.push({
      status: complaint.status,
      actorId: admin.id as any,
      role: 'admin',
      timestamp: new Date(),
      remarks:
        remarks ||
        `Manual Triage: Assigned to Ward ${wardId ? wardId : 'unchanged'} and Agency ${agencyId ? agencyId : 'unchanged'} by Administrator.`,
    });

    await complaint.save();

    const populated = await Complaint.findById(complaint._id)
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName')
      .populate('reportedBy', 'name email');

    // Notify assigned officer
    try {
      const assignedOfficer = await User.findOne({
        role: 'officer',
        assignedWardId: complaint.wardId,
      }).select('_id');
      if (assignedOfficer) {
        await notifyAssignment(assignedOfficer._id.toString(), populated);
      }
    } catch (notifErr: any) {
      console.warn('Failed to send assignment notification:', notifErr.message);
    }

    return NextResponse.json({
      message: 'Complaint successfully triaged and assigned',
      complaint: populated,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
