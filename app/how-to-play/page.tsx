import type { Metadata } from "next";
import { HowToPlayPage } from "@/components/how-to-play-page";

export const metadata: Metadata = {
  title: "How to Play | F-Ball",
};

export default function HowToPlayRoute() {
  return <HowToPlayPage />;
}
