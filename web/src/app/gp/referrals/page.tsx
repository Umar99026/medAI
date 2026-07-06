"use client";

import { AuthGate } from "@/components/AuthGate";
import { GpSentReferralsPage } from "@/components/GpSentReferralsPage";

export default function GpSentReferralsRoute() {
  return <AuthGate role="GP" Page={GpSentReferralsPage} />;
}
