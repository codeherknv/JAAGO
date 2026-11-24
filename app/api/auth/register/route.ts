import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { User } from '@/models/User';
import { OfficerAllowList } from '@/models/OfficerAllowList';
import { registerSchema } from '@/lib/validations';
import { formatApiError } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    if (process.env.DEMO_AUTH !== 'true') {
      return NextResponse.json(
        { error: 'Password registration is disabled unless credentials auth is enabled.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validated = registerSchema.parse(body);

    await connectToDatabase();

    const existing = await User.findOne({ email: validated.email }).lean();
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists. Please sign in instead.' },
        { status: 409 }
      );
    }

    // Determine role strictly server-side (prevent privilege escalation)
    const allowEntry = await OfficerAllowList.findOne({
      email: validated.email,
      isActive: true,
    });

    const configuredAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
    const isAdminEmail = Boolean(
      (configuredAdminEmail && validated.email === configuredAdminEmail) ||
        validated.email === 'admin@demo.jaago.app'
    );

    const role = isAdminEmail ? 'admin' : allowEntry ? 'officer' : 'citizen';
    const hashedPassword = await bcrypt.hash(validated.password, 12);

    const newUser = await User.create({
      name: validated.name,
      email: validated.email,
      password: hashedPassword,
      role,
      assignedWardId: allowEntry?.assignedWardId,
      agencyId: allowEntry?.agencyId,
    });

    return NextResponse.json(
      {
        message: 'Account created successfully',
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return formatApiError(error);
  }
}
