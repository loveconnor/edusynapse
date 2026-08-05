"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { AppSearch, type AppSearchData } from "@/components/app-search";
import { navGroups } from "@/components/app-shared";
import { CustomTrigger } from "@/components/custom-trigger";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Settings } from "love-ui/icons";

export function AppSidebar({ learningItems, materials }: AppSearchData) {
	return (
		<Sidebar
			className={cn(
				"*:data-[slot=sidebar-inner]:bg-background",
				"transition-[left,right,top,width] group-data-[collapsible=offcanvas]:top-[calc(var(--app-header-height)*0.5)]"
			)}
			collapsible="offcanvas"
			variant="sidebar"
		>
			<SidebarHeader className="h-(--app-header-height,3rem) flex-row items-center justify-between">
				<Button asChild variant="ghost">
					<Link href="/dashboard">
						<span className="font-medium">EduSynapse</span>
					</Link>
				</Button>
				<CustomTrigger place="sidebar" />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<AppSearch learningItems={learningItems} materials={materials} />
				</SidebarGroup>
				{navGroups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
							{group.label}
						</SidebarGroupLabel>
						<SidebarMenu>
							{group.items.map((item) => (
								<SidebarMenuItem key={item.title}>
									{item.isDisabled || !item.path ? (
										<SidebarMenuButton
											aria-label={`${item.title} — Coming soon`}
											disabled
										>
											{item.icon}
											<span>{item.title}</span>
											<span className="ml-auto text-[10px] font-normal text-muted-foreground">
												Soon
											</span>
										</SidebarMenuButton>
									) : (
										<SidebarMenuButton
											isActive={item.isActive}
											render={<Link href={item.path} />}
											tooltip={item.title}
										>
											{item.icon}
											<span>{item.title}</span>
										</SidebarMenuButton>
									)}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroup>
				))}
			</SidebarContent>
			<SidebarFooter className="px-4">
				<div className="flex items-center pt-4 pb-2">
					<ThemeSwitcher />
					<Button
						asChild
						className="text-muted-foreground"
						size="icon-sm"
						variant="ghost"
					>
						<a aria-label="Settings" href="#">
							<Settings
							/>
						</a>
					</Button>
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
