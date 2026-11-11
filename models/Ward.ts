import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWard extends Document {
  name: string;
  code: string;
  corporation: string;
  boundary: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  createdAt: Date;
  updatedAt: Date;
}

const WardSchema = new Schema<IWard>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    corporation: { type: String, required: true, default: 'Greater Bengaluru Authority' },
    boundary: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon'],
        required: true,
      },
      coordinates: {
        type: Schema.Types.Mixed,
        required: true,
      },
    },
  },
  { timestamps: true }
);

WardSchema.index({ boundary: '2dsphere' });

export const Ward: Model<IWard> = mongoose.models.Ward || mongoose.model<IWard>('Ward', WardSchema);
export default Ward;
