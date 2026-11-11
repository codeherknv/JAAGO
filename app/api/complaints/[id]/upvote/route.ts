import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { Vote } from '@/models/Vote';
import { User } from '@/models/User';
import { calculatePriorityScore } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const complaintId = params.id;

    await connectToDatabase();

    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Resolve acting user ID: from session or body/fallback for testing
    let userId = session?.user?.id;
    if (!userId) {
      try {
        const body = await req.json();
        if (body?.userId) {
          userId = body.userId;
        }
      } catch {
        // Body might be empty
      }
    }

    if (!userId) {
      // Use or create a test citizen user if unauthenticated demo
      let defaultUser = await User.findOne({ role: 'citizen' });
      if (!defaultUser) {
        defaultUser = await User.create({
          name: 'Demo Citizen Voter',
          email: 'citizen.voter@jaago.in',
          role: 'citizen',
        });
      }
      userId = defaultUser._id.toString();
    }

    // Invariant 3: Scalable Atomic Upvoting
    // 1. Attempt insertion into Vote collection with compound unique index { complaintId: 1, userId: 1 }
    try {
      await Vote.create({
        complaintId,
        userId,
      });
    } catch (voteErr: any) {
      // MongoDB E11000 duplicate key error means user has already upvoted
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

    // 2. Perform atomic increment $inc: { upvotesCount: 1 }
    const updatedComplaint = await Complaint.findByIdAndUpdate(
      complaintId,
      { $inc: { upvotesCount: 1 } },
      { new: true }
    );

    if (updatedComplaint) {
      // Recalculate priority score with new upvotes
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
    console.error('Error upvoting complaint:', error);
    return NextResponse.json(
      { error: 'Failed to record upvote', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const complaintId = params.id;
    const { searchParams } = new URL(req.url);
    const queryUserId = searchParams.get('userId') || session?.user?.id;

    if (!queryUserId) {
      return NextResponse.json({ hasUpvoted: false });
    }

    await connectToDatabase();
    const existingVote = await Vote.findOne({
      complaintId,
      userId: queryUserId,
    });

    return NextResponse.json({
      hasUpvoted: !!existingVote,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check vote status', details: error.message },
      { status: 500 }
    );
  }
}
