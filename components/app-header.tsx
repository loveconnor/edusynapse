"use client";

import { usePathname } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { navLinks } from "@/components/app-shared";
import { CoachChatControls } from "@/components/ai-coach/coach-chat-controls";
import { CustomTrigger } from "@/components/custom-trigger";
import { NavUser, type NavUserData } from "@/components/nav-user";

export function AppHeader({ user }: { user: NavUserData }) {
	const pathname = usePathname();
	const activeItem = navLinks.find(
		(item) =>
			item.path &&
			(pathname === item.path || pathname.startsWith(`${item.path}/`)),
	);
	const pageTitle =
		activeItem?.title ??
		(pathname.startsWith("/learning") ? "My Learning" : "EduSynapse");
	const isAiCoach = pathname === "/ai-coach";

	return (
		<header className="sticky top-0 z-50 grid h-(--app-header-height) w-full shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b bg-background px-4 md:px-6">
			<div className="flex min-w-0 items-center gap-1 justify-self-start">
				{isAiCoach ? <CoachChatControls /> : null}
				<CustomTrigger place="navbar" />
			</div>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbPage>{pageTitle}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="flex items-center gap-3 justify-self-end">
				<NavUser user={user} />
			</div>
		</header>
	);
}
