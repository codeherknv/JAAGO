import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgency extends Document {
  name: string;
  shortName: string;
  jurisdictionCategories: string[];
  createdAt: Date;
  updatedAt: Date;
}

const AgencySchema = new Schema<IAgency>(
  {
    name: { type: String, required: true },
    shortName: { type: String, required: true, unique: true },
    jurisdictionCategories: [
      {
        type: String,
        enum: ['Roads', 'Sanitation', 'Streetlights', 'Water Supply & Drainage', 'Others'],
        required: true,
      },
    ],
  },
  { timestamps: true }
);

export const Agency: Model<IAgency> = mongoose.models.Agency || mongoose.model<IAgency>('Agency', AgencySchema);
export default Agency;
