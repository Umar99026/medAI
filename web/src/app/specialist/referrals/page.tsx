"use client";

import { AuthGate } from "@/components/AuthGate";
import { SpecialistReferralsPage } from "@/components/SpecialistReferralsPage";

export default function SpecialistReferralsRoute() {
  return <AuthGate role="SPECIALIST" Page={SpecialistReferralsPage} />;
}
