import { NextResponse, type NextRequest } from "next/server";
import { analyzeJump, BackendApiError, type JumpType } from "@/lib/api";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const video = formData.get("video");
  const userHeightCm = Number(formData.get("userHeightCm"));
  const jumpTypeRaw = formData.get("jumpType");
  const jumpType: JumpType = jumpTypeRaw === "broad" ? "broad" : "vertical";

  if (!(video instanceof File) || !userHeightCm || Number.isNaN(userHeightCm)) {
    return NextResponse.json({ error: "Missing video or userHeightCm" }, { status: 400 });
  }

  try {
    const result = await analyzeJump(video, userHeightCm, jumpType);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof BackendApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Jump analysis backend request failed", err);
    return NextResponse.json({ error: "Backend analysis failed" }, { status: 502 });
  }
}
