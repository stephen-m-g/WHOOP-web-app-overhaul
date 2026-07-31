"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong loading your dashboard</AlertTitle>
        <AlertDescription>
          This is unexpected — try again, and if it keeps happening, reconnecting your WHOOP
          account may help.
        </AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  );
}
