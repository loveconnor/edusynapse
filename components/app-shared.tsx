import type { ReactNode } from "react";
import {
  BookOpen,
  BotMessageSquare,
  ChartNoAxesCombined,
  Files,
} from "love-ui/icons";

export type SidebarNavItem = {
  title: string;
  path?: string;
  icon: ReactNode;
  isActive?: boolean;
  isDisabled?: boolean;
};

export type SidebarNavGroup = {
  label: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Learn",
    items: [
      {
        title: "My Learning",
        path: "/dashboard",
        icon: <BookOpen aria-hidden="true" />,
        isActive: true,
      },
      {
        title: "AI Coach",
        icon: <BotMessageSquare aria-hidden="true" />,
        isDisabled: true,
      },
    ],
  },
  {
    label: "Progress",
    items: [
      {
        title: "Insights",
        icon: <ChartNoAxesCombined aria-hidden="true" />,
        isDisabled: true,
      },
    ],
  },
  {
    label: "Library",
    items: [
      {
        title: "Materials",
        icon: <Files aria-hidden="true" />,
        isDisabled: true,
      },
    ],
  },
];

export const navLinks = navGroups.flatMap((group) => group.items);
