import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type UserRole = 'citizen' | 'officer' | 'admin';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: UserRole;
  assignedWardId?: Types.ObjectId;
  agencyId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String },
    image: { type: String },
    role: {
      type: String,
      enum: ['citizen', 'officer', 'admin'],
      default: 'citizen',
      required: true,
    },
    assignedWardId: { type: Schema.Types.ObjectId, ref: 'Ward' },
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency' },
  },
  { timestamps: true }
);

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export default User;
