"use client";

import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import * as React from "react";
import { Button } from "@/components/ui/button";

type ViewTransitionDocument = Document & {
	startViewTransition: (update: () => void) => {
		finished: Promise<void>;
	};
};

export function ThemeSwitcher() {
	const { setTheme, resolvedTheme } = useTheme();
	const prefersReducedMotion = useReducedMotion() ?? false;
	const isDark = resolvedTheme === "dark";

	const toggleTheme = React.useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			const nextTheme = isDark ? "light" : "dark";
			const root = document.documentElement;
			const applyTheme = () => {
				root.classList.remove("light", "dark");
				root.classList.add(nextTheme);
				root.style.colorScheme = nextTheme;
				setTheme(nextTheme);
			};

			if (prefersReducedMotion || !("startViewTransition" in document)) {
				applyTheme();
				return;
			}

			const bounds = event.currentTarget.getBoundingClientRect();
			root.style.setProperty(
				"--theme-transition-origin",
				`${bounds.left + bounds.width / 2}px ${bounds.top + bounds.height / 2}px`,
			);
			root.dataset.themeTransition = "circle-blur";

			const cleanup = () => {
				delete root.dataset.themeTransition;
				root.style.removeProperty("--theme-transition-origin");
			};

			try {
				const transition = (
					document as ViewTransitionDocument
				).startViewTransition(applyTheme);
				void transition.finished.then(cleanup, cleanup);
			} catch {
				cleanup();
				applyTheme();
			}
		},
		[isDark, prefersReducedMotion, setTheme],
	);

	return (
		<Button
			className="text-muted-foreground"
			onClick={toggleTheme}
			size="icon-sm"
			title={isDark ? "Switch to light theme" : "Switch to dark theme"}
			variant="ghost"
		>
			<svg
				aria-hidden="true"
				className="size-4.5"
				fill="none"
				focusable="false"
				height="24"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				viewBox="0 0 24 24"
				width="24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path d="M0 0h24v24H0z" fill="none" stroke="none" />
				<path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
				<path d="M12 3l0 18" />
				<path d="M12 9l4.65 -4.65" />
				<path d="M12 14.3l7.37 -7.37" />
				<path d="M12 19.6l8.85 -8.85" />
			</svg>
			<span className="sr-only">
				{isDark ? "Switch to light theme" : "Switch to dark theme"}
			</span>
		</Button>
	);
}
