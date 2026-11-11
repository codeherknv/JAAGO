import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Notification } from '@/models/Notification';
import { requireAuth, formatApiError } from '@/lib/apiAuth';
import { ObjectIdSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(req);
    const notificationId = ObjectIdSchema.parse(params.id);

    await connectToDatabase();
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId: user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, notification });
  } catch (error: any) {
    return formatApiError(error);
  }
}
