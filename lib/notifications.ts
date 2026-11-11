import nodemailer from 'nodemailer';
import { Notification, NotificationType } from '@/models/Notification';
import { User } from '@/models/User';
import { connectToDatabase } from './mongodb';

export interface SendNotificationOptions {
  userId: string | any;
  complaintId?: string | any;
  type: NotificationType;
  title: string;
  message: string;
  emailTo?: string;
}

/**
 * Configure Nodemailer transport:
 * Uses configured SMTP server if provided in environment variables;
 * otherwise uses JSON/stream transport with logging for dev/test.
 */
function createEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  // Development/Test mock transporter (records email data without failing)
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

/**
 * Send in-app notification and email to target user
 */
export async function sendNotification(options: SendNotificationOptions) {
  try {
    await connectToDatabase();
    const { userId, complaintId, type, title, message, emailTo } = options;

    let targetEmail = emailTo;
    if (!targetEmail) {
      const recipient = await User.findById(userId).select('email').lean();
      targetEmail = recipient?.email;
    }

    // 1. Create in-app notification record
    const notification = await Notification.create({
      userId,
      complaintId: complaintId || undefined,
      type,
      title,
      message,
      read: false,
      emailSent: false,
    });

    // 2. Dispatch email notification via Nodemailer
    if (targetEmail) {
      try {
        const transporter = createEmailTransporter();
        const info = await transporter.sendMail({
          from: process.env.EMAIL_FROM || '"Jaago Civic Alerts" <alerts@demo.jaago.app>',
          to: targetEmail,
          subject: `[Jaago Alert] ${title}`,
          text: `${message}\n\nView details on Jaago platform.`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
              <h2 style="color: #4338ca; margin-top: 0;">${title}</h2>
              <p style="color: #374151; font-size: 16px; line-height: 1.5;">${message}</p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                Notification Type: <strong>${type}</strong> • Sent by Jaago Civic Redressal
              </div>
            </div>
          `,
        });

        notification.emailSent = true;
        await notification.save();

        if (process.env.NODE_ENV !== 'test') {
          console.log(`[Email Sent] (${type}) To: ${targetEmail} | ID: ${info.messageId || 'local-json'}`);
        }
      } catch (emailErr: any) {
        console.warn(`[Email Delivery Warning]: Failed sending ${type} email to ${targetEmail}:`, emailErr.message);
      }
    }

    return notification;
  } catch (error: any) {
    console.error('[Notification System Error]:', error);
    return null;
  }
}

/**
 * Triggers for specific civic events
 */
export async function notifyAssignment(officerUserId: string, complaint: any) {
  return sendNotification({
    userId: officerUserId,
    complaintId: complaint._id,
    type: 'assignment',
    title: 'New Complaint Assigned to Your Jurisdiction',
    message: `A new ticket "${complaint.title}" in category "${complaint.category}" has been assigned to your jurisdiction.`,
  });
}

export async function notifyResolution(citizenUserId: string, complaint: any) {
  return sendNotification({
    userId: citizenUserId,
    complaintId: complaint._id,
    type: 'resolution',
    title: 'Resolution Submitted for Your Complaint',
    message: `Field officer marked "${complaint.title}" as resolved. You have 120 hours to inspect the photographic proof and confirm or contest the fix.`,
  });
}

export async function notifyReopen(officerUserId: string, complaint: any, disputeCount: number, remarks: string) {
  return sendNotification({
    userId: officerUserId,
    complaintId: complaint._id,
    type: 'reopen',
    title: `Complaint Resolution Contested (Dispute #${disputeCount})`,
    message: `Citizen rejected resolution for "${complaint.title}". Reopened with remarks: "${remarks}".`,
  });
}

export async function notify72hReminder(citizenUserId: string, complaint: any) {
  return sendNotification({
    userId: citizenUserId,
    complaintId: complaint._id,
    type: 'reminder',
    title: 'Action Reminder: 48 Hours Remaining for Citizen Audit',
    message: `72 hours have elapsed since "${complaint.title}" was resolved. Please audit the resolution proof within the next 48 hours before it automatically closes.`,
  });
}

export async function notifyAutoClose(citizenUserId: string, complaint: any) {
  return sendNotification({
    userId: citizenUserId,
    complaintId: complaint._id,
    type: 'auto_close',
    title: 'Complaint Auto-Closed (120 Hours Elapsed)',
    message: `The 120-hour citizen audit window for "${complaint.title}" has elapsed without dispute. The complaint has been automatically closed.`,
  });
}
