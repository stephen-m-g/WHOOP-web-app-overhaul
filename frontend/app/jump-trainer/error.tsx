"use client";

import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function JumpTrainerError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("Jump trainer failed to render", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          The jump trainer hit an unexpected error. Try again — if it keeps happening, try a
          different video.
        </AlertDescription>
      </Alert>
      <Button className="mt-4" onClick={() => unstable_retry()}>
        Try again
      </Button>
    </div>
  );
}
