"use client";

import { AuthGate } from "@/components/AuthGate";
import { SpecialistFilterPage } from "@/components/SpecialistFilterPage";

export default function SpecialistFilterRoute() {
  return <AuthGate role="SPECIALIST" Page={SpecialistFilterPage} />;
}
