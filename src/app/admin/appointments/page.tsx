import { redirect } from "next/navigation";

import { AppointmentsClient } from "@/app/admin/appointments/AppointmentsClient";
import { getCurrentOrgIdFromCookie } from "@/lib/cookies";

export default async function AdminAppointmentsPage() {
  const orgId = await getCurrentOrgIdFromCookie();
  if (!orgId) redirect("/admin/onboarding");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appointments</h1>
        <p className="text-sm text-muted-foreground">
          Booking pipeline: pending → invited → booked, with logs and approval-gated invites.
        </p>
      </div>
      <AppointmentsClient organizationId={orgId} />
    </div>
  );
}
