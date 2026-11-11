import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IOfficerAllowList extends Document {
  email: string;
  name: string;
  agencyId: Types.ObjectId;
  assignedWardId: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OfficerAllowListSchema = new Schema<IOfficerAllowList>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true },
    assignedWardId: { type: Schema.Types.ObjectId, ref: 'Ward', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const OfficerAllowList: Model<IOfficerAllowList> =
  mongoose.models.OfficerAllowList ||
  mongoose.model<IOfficerAllowList>('OfficerAllowList', OfficerAllowListSchema);
export default OfficerAllowList;
