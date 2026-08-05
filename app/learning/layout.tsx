import { AppRouteShell } from "@/components/app-route-shell";

export default function LearningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
