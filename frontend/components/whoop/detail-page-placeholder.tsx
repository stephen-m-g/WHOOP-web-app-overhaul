import Link from "next/link";

interface DetailPagePlaceholderProps {
  title: string;
  colorVar: string;
}

export function DetailPagePlaceholder({ title, colorVar }: DetailPagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-4 py-24 text-center">
      <span className="mb-2 inline-block size-2 rounded-full" style={{ backgroundColor: colorVar }} aria-hidden="true" />
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">
        Detailed historical trends and insights for this metric are coming soon.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
