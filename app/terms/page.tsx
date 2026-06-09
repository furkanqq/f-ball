import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms | F-Ball",
};

export default function TermsPage() {
  return <LegalPage type="terms" />;
}
