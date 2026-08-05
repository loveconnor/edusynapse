import type { Metadata } from "next";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export const metadata: Metadata = {
  title: "Dashboard | EduSynapse",
};

export default function DashboardPage() {
  return <DashboardSkeleton />;
}
