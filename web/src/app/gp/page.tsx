"use client";

import { AuthGate } from "@/components/AuthGate";
import { GpNotesPage } from "@/components/GpNotesPage";

export default function GpPage() {
  return <AuthGate role="GP" Page={GpNotesPage} />;
}
