import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { OfficerAllowList } from '@/models/OfficerAllowList';
import '@/models/Ward';
import '@/models/Agency';

export const dynamic = 'force-dynamic';

export interface DemoAccountPreset {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'officer' | 'citizen';
  badge: string;
  subtitle: string;
  shortCode: string;
}

const DEFAULT_DEMO_OFFICERS: DemoAccountPreset[] = [
  {
    email: 'officer.bellandur@demo.jaago.app',
    password: 'password123',
    name: 'Ramesh Gowda',
    role: 'officer',
    badge: 'Officer',
    subtitle: 'Bellandur (W-150) • BBMP-Roads',
    shortCode: 'AEE',
  },
  {
    email: 'officer.hsr@demo.jaago.app',
    password: 'password123',
    name: 'Sunita Rao',
    role: 'officer',
    badge: 'Officer',
    subtitle: 'HSR Layout (W-174) • BBMP-SWM',
    shortCode: 'HI',
  },
];

export async function GET() {
  if (process.env.DEMO_AUTH !== 'true') {
    return NextResponse.json({ error: 'Demo accounts are disabled' }, { status: 403 });
  }

  let officerAccounts: DemoAccountPreset[] = [...DEFAULT_DEMO_OFFICERS];

  try {
    await connectToDatabase();
    const allowListOfficers = await OfficerAllowList.find({
      isActive: true,
      email: /@demo\.jaago\.app$/i,
    })
      .populate('assignedWardId', 'name code')
      .populate('agencyId', 'shortName name')
      .lean();

    if (allowListOfficers.length > 0) {
      const merged = new Map<string, DemoAccountPreset>();
      for (const preset of DEFAULT_DEMO_OFFICERS) {
        merged.set(preset.email, preset);
      }

      for (const officer of allowListOfficers as any[]) {
        const wardLabel = officer.assignedWardId
          ? `${officer.assignedWardId.name} (${officer.assignedWardId.code})`
          : 'Ward Assigned';
        const agencyLabel = officer.agencyId?.shortName ? ` • ${officer.agencyId.shortName}` : '';
        const cleanName = String(officer.name || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || officer.name;

        merged.set(officer.email, {
          email: officer.email,
          password: 'password123',
          name: cleanName,
          role: 'officer',
          badge: 'Officer',
          subtitle: `${wardLabel}${agencyLabel}`,
          shortCode: officer.email.includes('hsr') ? 'HI' : 'AEE',
        });
      }

      officerAccounts = Array.from(merged.values());
    }
  } catch {
    // Fall back to default seeded demo officer definitions if DB is temporarily unreachable
  }

  const accounts: DemoAccountPreset[] = [
    {
      email: 'admin@demo.jaago.app',
      password: 'password123',
      name: 'Civic Commissioner Admin',
      role: 'admin',
      badge: 'Admin',
      subtitle: 'Control Center, Triage & Disputes',
      shortCode: 'ADM',
    },
    ...officerAccounts,
    {
      email: 'citizen.rahul@demo.jaago.app',
      password: 'password123',
      name: 'Rahul Sharma',
      role: 'citizen',
      badge: 'Citizen',
      subtitle: 'Resident • Bellandur (W-150)',
      shortCode: 'CIT',
    },
  ];

  return NextResponse.json({ accounts });
}
