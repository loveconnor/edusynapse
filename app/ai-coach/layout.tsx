import { AppRouteShell } from "@/components/app-route-shell";

export default function AiCoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppRouteShell>{children}</AppRouteShell>;
}
