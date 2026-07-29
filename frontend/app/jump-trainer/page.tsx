import { VideoUpload } from "@/components/jump-trainer/video-upload";

export default function JumpTrainerPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Jump Trainer</h1>
      <p className="mb-8 text-muted-foreground">
        Upload a video of your vertical or broad jump to get AI-powered coaching feedback.
      </p>
      <VideoUpload />
    </div>
  );
}
