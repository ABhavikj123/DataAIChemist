import { NextResponse } from "next/server"
import type { DataRow, GeminiCorrectionRequest, GeminiCorrectionResponse } from "@/types"

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end < 0) throw new Error("Gemini returned a non-JSON response.")
  return JSON.parse(cleaned.slice(start, end + 1))
}

function localCorrection(request: GeminiCorrectionRequest): GeminiCorrectionResponse {
  const instruction = request.instruction.toLowerCase()
  const rows = request.dataset.rows.map((row, index) => {
    if (request.rowIndex !== undefined && request.rowIndex !== index) return row

    const next: DataRow = { ...row }
    const fields = request.field ? [request.field] : Object.keys(next)

    fields.forEach((field) => {
      const value = next[field]
      if (instruction.includes("json") && field.toLowerCase().includes("json")) {
        try {
          JSON.parse(String(value ?? ""))
        } catch {
          next[field] = JSON.stringify({ message: String(value ?? "") })
        }
      }

      if (instruction.includes("uppercase") || instruction.includes("upper case")) {
        next[field] = typeof value === "string" ? value.toUpperCase() : value
      }

      if (instruction.includes("trim")) {
        next[field] = typeof next[field] === "string" ? String(next[field]).trim() : next[field]
      }
    })

    return next
  })

  return {
    rows,
    summary: "Applied deterministic local correction because Gemini is not configured.",
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as GeminiCorrectionRequest
  if (!body.dataset || !body.instruction?.trim()) {
    return NextResponse.json({ error: "A dataset and correction instruction are required." }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(localCorrection(body))
  }

  const prompt = `
You are a senior FinOps data quality agent. Correct records according to the user instruction.
Return only JSON in this exact shape:
{
  "rows": [{ "Column": "value" }],
  "summary": "Short explanation"
}

Rules:
- Preserve row count and all existing columns.
- Do not invent unrelated columns.
- Prefer numeric JSON values for amounts.
- If asked to repair JSON text, wrap unsafe text as {"message":"original text"}.

Dataset: ${body.dataset.name}
Headers: ${body.dataset.headers.join(", ")}
Instruction: ${body.instruction}
${body.rowIndex !== undefined ? `Only update row index ${body.rowIndex}.` : "Update every applicable row."}
${body.field ? `Only update field ${body.field}.` : ""}

Rows:
${JSON.stringify(body.dataset.rows)}
`

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 12000,
        responseMimeType: "application/json",
      },
    }),
  })

  const data = (await response.json()) as GeminiGenerateResponse
  if (!response.ok || data.error) {
    return NextResponse.json({ error: data.error?.message ?? "Gemini request failed." }, { status: response.status || 502 })
  }

  try {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    const parsed = extractJson(text) as GeminiCorrectionResponse
    return NextResponse.json({
      rows: Array.isArray(parsed.rows) ? parsed.rows : body.dataset.rows,
      summary: parsed.summary || "Gemini correction completed.",
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not parse Gemini response." }, { status: 502 })
  }
}
