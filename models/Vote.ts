import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IVote extends Document {
  complaintId: Types.ObjectId;
  userId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VoteSchema = new Schema<IVote>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

// Compound unique index ensuring each user can upvote a complaint at most once
VoteSchema.index({ complaintId: 1, userId: 1 }, { unique: true });

export const Vote: Model<IVote> = mongoose.models.Vote || mongoose.model<IVote>('Vote', VoteSchema);
export default Vote;
