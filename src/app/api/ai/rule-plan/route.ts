import { NextResponse } from "next/server"
import type { AuditRule, FinancialDataset, RuleFormula } from "@/types"

interface RulePlanRequest {
  rule: AuditRule
  dataset: FinancialDataset
}

interface GeminiGenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

function localFormula(rule: AuditRule, headers: string[]): RuleFormula | undefined {
  const field = headers.includes(rule.field)
    ? rule.field
    : headers.find((header) => header.toLowerCase() === rule.field.toLowerCase())

  if (!field) return undefined

  switch (rule.operator) {
    case "required":
      return { field, operator: "required" }
    case "equal":
      return { field, operator: "equal", value: rule.expectedValue ?? "" }
    case "not_equal":
      return { field, operator: "not_equal", value: rule.expectedValue ?? "" }
    case "contains":
      return { field, operator: "contains", value: rule.expectedValue ?? "" }
    case "does_not_contain":
      return { field, operator: "does_not_contain", value: rule.expectedValue ?? "" }
    case "starts_with":
      return { field, operator: "starts_with", value: rule.expectedValue ?? "" }
    case "ends_with":
      return { field, operator: "ends_with", value: rule.expectedValue ?? "" }
    case "positive":
      return { field, operator: "number_gte", value: 0 }
    case "negative":
      return { field, operator: "number_lte", value: 0 }
    case "greater_than":
      return { field, operator: "number_gt", value: rule.expectedValue ?? "" }
    case "less_than":
      return { field, operator: "number_lt", value: rule.expectedValue ?? "" }
    case "json":
      return { field, operator: "valid_json" }
    case "uppercase":
      return { field, operator: "uppercase" }
    case "lowercase":
      return { field, operator: "lowercase" }
    default:
      return undefined
  }
}

function parseRulePlan(text: string): { formulaAvailable: boolean; formula?: RuleFormula; summary?: string } {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start < 0 || end < 0) return { formulaAvailable: false }
  return JSON.parse(cleaned.slice(start, end + 1)) as { formulaAvailable: boolean; formula?: RuleFormula; summary?: string }
}

export async function POST(request: Request) {
  const body = (await request.json()) as RulePlanRequest
  if (!body.rule || !body.dataset) {
    return NextResponse.json({ error: "Rule and dataset are required." }, { status: 400 })
  }

  const fallbackFormula = localFormula(body.rule, body.dataset.headers)

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({
      formulaAvailable: Boolean(fallbackFormula),
      formula: fallbackFormula,
      aiEvaluationRequired: !fallbackFormula,
      summary: fallbackFormula
        ? "Compiled locally into a reusable deterministic formula."
        : "This rule needs Gemini evaluation because no safe local formula was found.",
    })
  }

  const prompt = `
Convert this audit rule into a deterministic formula this app can run locally.
Return only JSON:
{
  "formulaAvailable": true,
  "formula": { "field": "exact source header", "operator": "required|number_gte|number_lte|number_gt|number_lt|equal|not_equal|contains|does_not_contain|starts_with|ends_with|valid_json|uppercase|lowercase", "value": "optional" },
  "summary": "short explanation"
}

If the rule cannot be represented with those operators, return {"formulaAvailable":false,"summary":"why"}.

Dataset headers: ${body.dataset.headers.join(", ")}
Rule name: ${body.rule.name}
Rule description: ${body.rule.description}
Existing structured field: ${body.rule.field}
Existing structured operator: ${body.rule.operator}
Expected value: ${body.rule.expectedValue ?? ""}
`

  const response = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  })

  const data = (await response.json()) as GeminiGenerateResponse
  if (!response.ok || data.error) {
    return NextResponse.json({ error: data.error?.message ?? "Gemini rule planning failed." }, { status: response.status || 502 })
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  const parsed = parseRulePlan(text)
  const formula = parsed.formulaAvailable ? parsed.formula ?? fallbackFormula : undefined

  return NextResponse.json({
    formulaAvailable: Boolean(formula),
    formula,
    aiEvaluationRequired: !formula,
    summary: parsed.summary ?? (formula ? "Compiled into a local formula." : "No local formula is available."),
  })
}
