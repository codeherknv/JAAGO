import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { resolveComplaintSchema, ObjectIdSchema, verifyCloudinaryAssetSize } from '@/lib/validations';
import { notifyResolution } from '@/lib/notifications';
import {
  calculateHaversineDistance,
  calculateAllowedResolutionRadius,
  capGpsAccuracy,
} from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Enforce officer / admin role server-side
    const officer = await requireRole(['officer', 'admin'], req);

    // 2. Validate route param
    const complaintId = ObjectIdSchema.parse(params.id);

    // 3. Validate body with Zod
    const body = await req.json();
    const validatedData = resolveComplaintSchema.parse(body);
    const { lat, lng, accuracy, resolutionImageUrl, remarks } = validatedData;

    // Strict GPS Accuracy Quality Gate: reject accuracy worse than 50m
    if (accuracy > 50) {
      return NextResponse.json(
        {
          error: `GPS accuracy is too degraded (±${Math.round(accuracy)}m). Field resolution requires accuracy within 50m to verify on-site presence. Please step into an open area with a clear view of the sky and retry.`,
          reportedAccuracyMeters: accuracy,
          thresholdMeters: 50,
        },
        { status: 400 }
      );
    }

    // Verify asset size server-side (<= 5MB)
    const isValidSize = await verifyCloudinaryAssetSize(resolutionImageUrl);
    if (!isValidSize) {
      return NextResponse.json(
        { error: 'Resolution photo proof exceeds the strict 5MB limit. Please upload an image under 5MB.' },
        { status: 400 }
      );
    }

    // 4. Cap reported GPS accuracy at 100m
    const cappedAccuracy = capGpsAccuracy(accuracy);
    const allowedRadius = calculateAllowedResolutionRadius(cappedAccuracy);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }

    // Officer Ward Jurisdiction Guard:
    // Field officers can only resolve complaints within their assigned ward.
    if (officer.role === 'officer') {
      if (!officer.assignedWardId) {
        return NextResponse.json(
          { error: 'Forbidden: Officer has no assigned ward jurisdiction.' },
          { status: 403 }
        );
      }
      if (!complaint.wardId) {
        return NextResponse.json(
          { error: 'Forbidden: Officer action not permitted on unrouted complaint with no ward assignment.' },
          { status: 403 }
        );
      }
      if (String(officer.assignedWardId) !== String(complaint.wardId)) {
        return NextResponse.json(
          {
            error:
              'Forbidden: Officers are restricted to resolving complaints within their assigned ward jurisdiction.',
          },
          { status: 403 }
        );
      }
    }

    // 5. Verify distance against original complaint coordinates [lng, lat]
    const complaintLng = complaint.location.coordinates[0];
    const complaintLat = complaint.location.coordinates[1];

    const actualDistance = calculateHaversineDistance(lat, lng, complaintLat, complaintLng);

    if (actualDistance > allowedRadius) {
      return NextResponse.json(
        {
          error: `Location Verification Failed: You are ${Math.round(
            actualDistance
          )}m away from the incident location. Maximum allowed radius is ${Math.round(
            allowedRadius
          )}m (accuracy: ±${Math.round(cappedAccuracy)}m + 15m threshold). Field officers must be physically on-site to record resolution.`,
          distanceMeters: Math.round(actualDistance),
          allowedRadiusMeters: Math.round(allowedRadius),
          reportedAccuracyMeters: accuracy,
          cappedAccuracyMeters: cappedAccuracy,
        },
        { status: 403 }
      );
    }

    // 6. Transition to 'Pending Verification' with 120-hour window
    const verificationDeadline = new Date(Date.now() + 120 * 60 * 60 * 1000);

    complaint.status = 'Pending Verification';
    complaint.resolutionImageUrl = resolutionImageUrl;
    complaint.verificationDeadline = verificationDeadline;
    complaint.reminderSentAt = undefined;

    // 7. Store capped accuracy in statusHistory (Invariant 7)
    complaint.statusHistory.push({
      status: 'Pending Verification',
      actorId: officer.id as any,
      role: officer.role,
      timestamp: new Date(),
      remarks:
        remarks ||
        `Resolution proof captured on-site (${Math.round(actualDistance)}m away, GPS accuracy ±${Math.round(
          cappedAccuracy
        )}m). Submitted to 120h citizen audit.`,
      imageUrl: resolutionImageUrl,
      locationAccuracy: cappedAccuracy,
      resolutionDistanceMeters: Math.round(actualDistance),
    });

    await complaint.save();

    // Send notification to citizen reporter
    try {
      await notifyResolution(complaint.reportedBy.toString(), complaint);
    } catch (notifErr: any) {
      console.warn('Failed to send resolution notification:', notifErr.message);
    }

    return NextResponse.json({
      message: 'Resolution verified and accepted. Complaint transitioned to Pending Verification.',
      complaint,
      distanceMeters: Math.round(actualDistance),
      allowedRadiusMeters: Math.round(allowedRadius),
      cappedAccuracyMeters: cappedAccuracy,
    });
  } catch (error: any) {
    return formatApiError(error);
  }
}
