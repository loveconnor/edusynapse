import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { navLinks } from "@/components/app-shared";
import { CustomTrigger } from "@/components/custom-trigger";
import { NavUser, type NavUserData } from "@/components/nav-user";

export function AppHeader({ user }: { user: NavUserData }) {
	const activeItem = navLinks.find((item) => item.isActive);

	return (
		<header className="sticky top-0 z-50 flex h-(--app-header-height) w-full shrink-0 items-center justify-between gap-2 border-b bg-background px-4 md:px-6">
			<div className="flex items-center gap-3">
				<CustomTrigger place="navbar" />
			</div>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbPage>{activeItem?.title}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="flex items-center gap-3">
				<NavUser user={user} />
			</div>
		</header>
	);
}
