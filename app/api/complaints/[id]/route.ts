import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { Vote } from '@/models/Vote';
import { Notification } from '@/models/Notification';
import { ObjectIdSchema, updateComplaintSchema } from '@/lib/validations';
import { requireAuth, formatApiError } from '@/lib/apiAuth';
import '@/models/Ward';
import '@/models/Agency';
import '@/models/User';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const complaintId = ObjectIdSchema.parse(params.id);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId)
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
    return formatApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req);
    const complaintId = ObjectIdSchema.parse(params.id);

    const body = await req.json();
    const validated = updateComplaintSchema.parse(body);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Authorization:
    // 1. Admin can edit any complaint
    // 2. Citizen can edit their own complaints
    // 3. Officer can edit complaints assigned to their ward OR complaints they reported
    const isAdmin = user.role === 'admin';
    const reportedById = (complaint.reportedBy as any)?._id
      ? (complaint.reportedBy as any)._id.toString()
      : complaint.reportedBy?.toString();
    const isOwner = Boolean(user.id && reportedById === user.id);

    const complaintWardId = (complaint.wardId as any)?._id
      ? (complaint.wardId as any)._id.toString()
      : complaint.wardId?.toString();
    const isAssignedOfficer =
      user.role === 'officer' &&
      Boolean((user.assignedWardId && complaintWardId === user.assignedWardId) || isOwner);

    if (!isAdmin && !isOwner && !isAssignedOfficer) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this complaint.' },
        { status: 403 }
      );
    }

    if (validated.title !== undefined) complaint.title = validated.title;
    if (validated.description !== undefined) complaint.description = validated.description;
    if (validated.category !== undefined) complaint.category = validated.category;
    if (validated.address !== undefined) complaint.address = validated.address;

    complaint.statusHistory.push({
      status: complaint.status,
      actorId: user.id as any,
      role: user.role as any,
      timestamp: new Date(),
      remarks: `[Complaint Details Updated by ${user.role}]`,
    });

    await complaint.save();

    const populated = await Complaint.findById(complaint._id)
      .populate('wardId', 'name code corporation')
      .populate('agencyId', 'name shortName jurisdictionCategories')
      .populate('reportedBy', 'name email image')
      .populate('statusHistory.actorId', 'name email role image')
      .lean();

    return NextResponse.json({
      message: 'Complaint updated successfully',
      complaint: populated,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}

export const PUT = PATCH;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req);
    const complaintId = ObjectIdSchema.parse(params.id);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Authorization:
    // 1. Admin can delete any complaint
    // 2. Citizen can delete their own complaints
    // 3. Officer can delete complaints assigned to their ward OR complaints they reported
    const isAdmin = user.role === 'admin';
    const reportedById = (complaint.reportedBy as any)?._id
      ? (complaint.reportedBy as any)._id.toString()
      : complaint.reportedBy?.toString();
    const isOwner = Boolean(user.id && reportedById === user.id);

    const complaintWardId = (complaint.wardId as any)?._id
      ? (complaint.wardId as any)._id.toString()
      : complaint.wardId?.toString();
    const isAssignedOfficer =
      user.role === 'officer' &&
      Boolean((user.assignedWardId && complaintWardId === user.assignedWardId) || isOwner);

    if (!isAdmin && !isOwner && !isAssignedOfficer) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this complaint.' },
        { status: 403 }
      );
    }

    // Clean up associated votes and notifications
    await Promise.all([
      Vote.deleteMany({ complaintId }),
      Notification.deleteMany({ complaintId }),
      Complaint.findByIdAndDelete(complaintId),
    ]);

    return NextResponse.json({
      message: 'Complaint deleted successfully',
      id: complaintId,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
