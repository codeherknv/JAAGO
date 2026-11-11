import { connectToDatabase } from './mongodb';
import { Complaint } from '@/models/Complaint';
import { Vote } from '@/models/Vote';
import { calculatePriorityScore } from './geo';

/**
 * Reconcile votes for a single complaint or all complaints across the database,
 * ensuring upvotesCount strictly matches Vote.countDocuments({ complaintId }).
 */
export async function reconcileComplaintVotes(complaintId: any) {
  await connectToDatabase();
  const actualVotes = await Vote.countDocuments({ complaintId });
  const complaint = await Complaint.findById(complaintId);
  if (!complaint) return null;

  if (complaint.upvotesCount !== actualVotes) {
    complaint.upvotesCount = actualVotes;
    complaint.priorityScore = calculatePriorityScore(
      complaint.category,
      actualVotes,
      complaint.createdAt,
      complaint.reopenCount
    );
    await complaint.save();
  }

  return { complaintId, actualVotes, upvotesCount: complaint.upvotesCount };
}

export async function reconcileAllVotes() {
  await connectToDatabase();
  const complaints = await Complaint.find();
  const results = [];
  for (const c of complaints) {
    const res = await reconcileComplaintVotes(c._id);
    results.push(res);
  }
  return results;
}
