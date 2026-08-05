"use client";

import { LogOut } from "love-ui/icons";
import { signOut } from "@/app/dashboard/actions";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type NavUserData = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

function getInitials(name: string, email: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 1) {
    return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`.toUpperCase();
  }

  return (words[0]?.[0] ?? email[0] ?? "U").toUpperCase();
}

function UserAvatar({ user, size = "sm" }: { user: NavUserData; size?: "sm" | "lg" }) {
  const initials = getInitials(user.name, user.email);

  return (
    <Avatar className={size === "lg" ? "size-10" : "size-8"}>
      {user.avatarUrl ? <AvatarImage alt="" src={user.avatarUrl} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function NavUser({ user }: { user: NavUserData }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Open user menu for ${user.name}`}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        render={<button type="button" />}
      >
        <UserAvatar user={user} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
            <UserAvatar user={user} size="lg" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <form action={signOut}>
            <DropdownMenuItem
              className="w-full cursor-pointer"
              nativeButton
              render={<button type="submit" />}
              variant="destructive"
            >
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
