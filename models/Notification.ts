import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export type NotificationType =
  | 'assignment'
  | 'resolution'
  | 'reopen'
  | 'reminder'
  | 'auto_close'
  | 'status_update';

export interface INotification extends Document {
  userId: Types.ObjectId;
  complaintId?: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  emailSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', index: true },
    type: {
      type: String,
      required: true,
      enum: ['assignment', 'resolution', 'reopen', 'reminder', 'auto_close', 'status_update'],
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false, index: true },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification: Model<INotification> =
  mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);

export default Notification;
