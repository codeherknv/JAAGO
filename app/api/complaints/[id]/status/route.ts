import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { updateStatusSchema, ObjectIdSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const officer = await requireRole(['officer', 'admin']);
    const complaintId = ObjectIdSchema.parse(params.id);

    const body = await req.json();
    const { status, remarks } = updateStatusSchema.parse(body);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    complaint.status = status;
    complaint.statusHistory.push({
      status,
      actorId: officer.id as any,
      role: officer.role,
      timestamp: new Date(),
      remarks: remarks || `Status transitioned to ${status}`,
    });

    await complaint.save();

    return NextResponse.json({
      message: `Status updated to ${status}`,
      complaint,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
