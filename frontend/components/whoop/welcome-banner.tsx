import { cn, GLASS_CARD } from "@/lib/utils";

interface WelcomeBannerProps {
  firstName: string | null;
  insight: string | null;
}

export function WelcomeBanner({ firstName, insight }: WelcomeBannerProps) {
  return (
    <div className="relative mb-8 inline-block max-w-2xl">
      <div className="absolute -bottom-2 left-8 z-0 size-4 rotate-45 rounded-sm bg-card/55 backdrop-blur-md" aria-hidden="true" />
      <div className={cn("relative z-10 rounded-3xl px-6 py-5 ring-1 ring-foreground/10", GLASS_CARD)}>
        <h1 className="font-stat text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome{firstName ? `, ${firstName}` : ""}!
        </h1>
        {insight && <p className="mt-2 text-muted-foreground">{insight}</p>}
      </div>
    </div>
  );
}
