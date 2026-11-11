import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { OfficerAllowList } from '@/models/OfficerAllowList';
import { User } from '@/models/User';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { addOfficerSchema } from '@/lib/validations';
import '@/models/Ward';
import '@/models/Agency';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin'], req);
    await connectToDatabase();

    const officers = await OfficerAllowList.find()
      .populate('assignedWardId', 'name code corporation')
      .populate('agencyId', 'name shortName jurisdictionCategories')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ count: officers.length, officers });
  } catch (error: any) {
    return formatApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin'], req);
    const body = await req.json();
    const validated = addOfficerSchema.parse(body);
    const { name, email, agencyId, assignedWardId, isActive } = validated;

    await connectToDatabase();

    const existing = await OfficerAllowList.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: `Officer with email '${email}' is already on the allow-list.` },
        { status: 409 }
      );
    }

    const newOfficer = await OfficerAllowList.create({
      name,
      email,
      agencyId,
      assignedWardId,
      isActive: isActive !== undefined ? isActive : true,
    });

    // If an existing User record exists, upgrade role and link ward/agency
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.role = 'officer';
      existingUser.assignedWardId = assignedWardId as any;
      existingUser.agencyId = agencyId as any;
      await existingUser.save();
    }

    const populated = await OfficerAllowList.findById(newOfficer._id)
      .populate('assignedWardId', 'name code corporation')
      .populate('agencyId', 'name shortName jurisdictionCategories');

    return NextResponse.json(
      { message: 'Officer added to allow-list successfully', officer: populated },
      { status: 201 }
    );
  } catch (error: any) {
    return formatApiError(error);
  }
}
