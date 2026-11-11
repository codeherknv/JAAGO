import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type ComplaintCategory =
  | 'Roads'
  | 'Sanitation'
  | 'Streetlights'
  | 'Water Supply & Drainage'
  | 'Others';

export type ComplaintStatus =
  | 'Pending'
  | 'In Progress'
  | 'Pending Verification'
  | 'Resolved - Citizen Verified'
  | 'Resolved - Auto Closed'
  | 'Reopened - Escalated'
  | 'Disputed - Admin Review'
  | 'Rejected - Invalid';

export interface IStatusHistory {
  _id?: Types.ObjectId;
  status: ComplaintStatus;
  actorId: Types.ObjectId;
  role: 'citizen' | 'officer' | 'admin' | 'system';
  timestamp: Date;
  remarks?: string;
  imageUrl?: string;
  locationAccuracy?: number;
  resolutionDistanceMeters?: number;
}

export interface IComplaint extends Document {
  title: string;
  description: string;
  category: ComplaintCategory;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  address: string;
  wardId: Types.ObjectId;
  agencyId?: Types.ObjectId;
  imageUrl: string;
  resolutionImageUrl?: string;
  status: ComplaintStatus;
  reportedBy: Types.ObjectId;
  upvotesCount: number;
  reopenCount: number;
  priorityScore: number;
  verificationDeadline?: Date;
  statusHistory: IStatusHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const StatusHistorySchema = new Schema<IStatusHistory>(
  {
    status: {
      type: String,
      required: true,
      enum: [
        'Pending',
        'In Progress',
        'Pending Verification',
        'Resolved - Citizen Verified',
        'Resolved - Auto Closed',
        'Reopened - Escalated',
        'Disputed - Admin Review',
        'Rejected - Invalid',
      ],
    },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: {
      type: String,
      required: true,
      enum: ['citizen', 'officer', 'admin', 'system'],
    },
    timestamp: { type: Date, default: Date.now },
    remarks: { type: String },
    imageUrl: { type: String },
    locationAccuracy: { type: Number },
    resolutionDistanceMeters: { type: Number },
  },
  { _id: true }
);

const ComplaintSchema = new Schema<IComplaint>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: {
      type: String,
      required: true,
      enum: ['Roads', 'Sanitation', 'Streetlights', 'Water Supply & Drainage', 'Others'],
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    address: { type: String, required: true },
    wardId: { type: Schema.Types.ObjectId, ref: 'Ward', required: true, index: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', index: true },
    imageUrl: { type: String, required: true },
    resolutionImageUrl: { type: String },
    status: {
      type: String,
      required: true,
      enum: [
        'Pending',
        'In Progress',
        'Pending Verification',
        'Resolved - Citizen Verified',
        'Resolved - Auto Closed',
        'Reopened - Escalated',
        'Disputed - Admin Review',
        'Rejected - Invalid',
      ],
      default: 'Pending',
      index: true,
    },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    upvotesCount: { type: Number, default: 1 },
    reopenCount: { type: Number, default: 0 },
    priorityScore: { type: Number, default: 0, index: -1 },
    verificationDeadline: { type: Date, index: true },
    statusHistory: [StatusHistorySchema],
  },
  { timestamps: true }
);

// 2dsphere index for location-based spatial queries ($near, $geoWithin)
ComplaintSchema.index({ location: '2dsphere' });
// Compound index for active complaints by category and status
ComplaintSchema.index({ category: 1, status: 1 });

export const Complaint: Model<IComplaint> =
  mongoose.models.Complaint || mongoose.model<IComplaint>('Complaint', ComplaintSchema);
export default Complaint;
