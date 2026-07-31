import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Skeleton className="mb-2 h-10 w-64" />
      <Skeleton className="mb-8 h-5 w-96 max-w-full" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-around gap-6 py-6">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="size-24 rounded-full" />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
