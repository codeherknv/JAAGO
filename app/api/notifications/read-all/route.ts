import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Notification } from '@/models/Notification';
import { requireAuth, formatApiError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectToDatabase();

    await Notification.updateMany({ userId: user.id, read: false }, { read: true });

    return NextResponse.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    return formatApiError(error);
  }
}
