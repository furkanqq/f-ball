import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy | F-Ball",
};

export default function PrivacyPage() {
  return <LegalPage type="privacy" />;
}
