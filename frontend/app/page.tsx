import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Train smarter with your <span className="text-primary">WHOOP</span> data
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Connect your WHOOP account to see recovery, sleep, and workout metrics — then
        upload a jump video for AI-powered coaching feedback.
      </p>
      <div className="flex gap-4">
        <Button size="lg" nativeButton={false} render={<Link href="/dashboard">View Dashboard</Link>} />
        <Button
          size="lg"
          variant="outline"
          nativeButton={false}
          render={<Link href="/jump-trainer">Try Jump Trainer</Link>}
        />
      </div>
    </div>
  );
}
