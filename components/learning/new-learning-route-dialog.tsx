"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { NewLearningDialog } from "@/components/learning/new-learning-dialog";

export function NewLearningRouteDialog({
  defaultTitle,
}: {
  defaultTitle?: string;
}) {
  const [open, setOpen] = useState(true);
  const router = useRouter();

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) router.replace("/dashboard");
    },
    [router],
  );

  return (
    <NewLearningDialog
      defaultTitle={defaultTitle}
      open={open}
      onOpenChange={handleOpenChange}
    />
  );
}
