import type { GeminiCorrectionRequest, GeminiCorrectionResponse } from "@/types"

export async function correctDatasetWithGemini(request: GeminiCorrectionRequest): Promise<GeminiCorrectionResponse> {
  const response = await fetch("/api/ai/correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  })

  const payload = (await response.json()) as { error?: string } & Partial<GeminiCorrectionResponse>
  if (!response.ok) {
    throw new Error(payload.error ?? "Gemini correction failed")
  }

  return {
    rows: payload.rows ?? request.dataset.rows,
    summary: payload.summary ?? "No changes were returned.",
  }
}
