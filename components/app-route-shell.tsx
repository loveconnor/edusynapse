import { AppShell } from "@/components/app-shell";
import { getAppPageContext } from "@/lib/app-page-context";

export async function AppRouteShell({ children }: { children: React.ReactNode }) {
  const { shellProps } = await getAppPageContext();

  return <AppShell {...shellProps}>{children}</AppShell>;
}
