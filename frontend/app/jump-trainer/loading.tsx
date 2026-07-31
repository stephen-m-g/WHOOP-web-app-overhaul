import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function JumpTrainerLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Skeleton className="mb-2 h-9 w-48" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
