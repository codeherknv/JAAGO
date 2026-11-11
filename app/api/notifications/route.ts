import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Notification } from '@/models/Notification';
import { requireAuth, formatApiError } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectToDatabase();

    const notifications = await Notification.find({ userId: user.id })
      .populate('complaintId', 'title status category')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId: user.id,
      read: false,
    });

    return NextResponse.json({
      count: notifications.length,
      unreadCount,
      notifications,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
