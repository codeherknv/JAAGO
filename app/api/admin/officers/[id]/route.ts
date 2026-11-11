import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { OfficerAllowList } from '@/models/OfficerAllowList';
import { User } from '@/models/User';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { updateOfficerSchema, ObjectIdSchema } from '@/lib/validations';
import '@/models/Ward';
import '@/models/Agency';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole(['admin'], req);
    const officerId = ObjectIdSchema.parse(params.id);

    const body = await req.json();
    const validated = updateOfficerSchema.parse(body);
    const { isActive, assignedWardId, agencyId } = validated;

    await connectToDatabase();
    const officer = await OfficerAllowList.findById(officerId);
    if (!officer) {
      return NextResponse.json({ error: 'Officer allow-list record not found' }, { status: 404 });
    }

    if (isActive !== undefined) officer.isActive = isActive;
    if (assignedWardId !== undefined) officer.assignedWardId = assignedWardId as any;
    if (agencyId !== undefined) officer.agencyId = agencyId as any;

    await officer.save();

    // Synchronize User record
    const associatedUser = await User.findOne({ email: officer.email });
    if (associatedUser) {
      if (isActive === false) {
        associatedUser.role = 'citizen';
      } else if (isActive === true) {
        associatedUser.role = 'officer';
      }
      if (assignedWardId) associatedUser.assignedWardId = assignedWardId as any;
      if (agencyId) associatedUser.agencyId = agencyId as any;
      await associatedUser.save();
    }

    const populated = await OfficerAllowList.findById(officer._id)
      .populate('assignedWardId', 'name code corporation')
      .populate('agencyId', 'name shortName jurisdictionCategories');

    return NextResponse.json({
      message: 'Officer allow-list record updated successfully',
      officer: populated,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
