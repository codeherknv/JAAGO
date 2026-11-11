import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Complaint } from '@/models/Complaint';
import { requireRole, formatApiError } from '@/lib/apiAuth';
import { resolveComplaintSchema, ObjectIdSchema } from '@/lib/validations';
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

    // 4. Cap reported GPS accuracy at 100m
    const cappedAccuracy = capGpsAccuracy(accuracy);
    const allowedRadius = calculateAllowedResolutionRadius(cappedAccuracy);

    await connectToDatabase();
    const complaint = await Complaint.findById(complaintId);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
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
