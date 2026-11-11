import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { Vote } from '@/models/Vote';
import { calculatePriorityScore } from '@/lib/geo';
import { requireAuth, formatApiError } from '@/lib/apiAuth';
import { ObjectIdSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const complaintId = ObjectIdSchema.parse(params.id);

    await connectToDatabase();

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Invariant 3: Scalable Atomic Upvoting via Vote unique compound index
    try {
      await Vote.create({
        complaintId,
        userId: user.id,
      });
    } catch (voteErr: any) {
      if (voteErr.code === 11000) {
        return NextResponse.json(
          {
            error: 'You have already upvoted this complaint',
            alreadyUpvoted: true,
            upvotesCount: complaint.upvotesCount,
          },
          { status: 409 }
        );
      }
      throw voteErr;
    }

    // Atomic increment
    const updatedComplaint = await Complaint.findByIdAndUpdate(
      complaintId,
      { $inc: { upvotesCount: 1 } },
      { new: true }
    );

    if (updatedComplaint) {
      const newScore = calculatePriorityScore(
        updatedComplaint.category,
        updatedComplaint.upvotesCount,
        updatedComplaint.createdAt,
        updatedComplaint.reopenCount
      );
      updatedComplaint.priorityScore = newScore;
      await updatedComplaint.save();
    }

    return NextResponse.json({
      message: 'Upvote recorded successfully',
      upvotesCount: updatedComplaint ? updatedComplaint.upvotesCount : complaint.upvotesCount + 1,
      alreadyUpvoted: false,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const complaintId = ObjectIdSchema.parse(params.id);
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get('userId');

    await connectToDatabase();

    let userId = queryUserId;
    if (!userId) {
      try {
        const user = await requireAuth();
        userId = user.id;
      } catch {
        return NextResponse.json({ hasUpvoted: false });
      }
    }

    const existingVote = await Vote.findOne({
      complaintId,
      userId,
    });

    return NextResponse.json({
      hasUpvoted: !!existingVote,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
