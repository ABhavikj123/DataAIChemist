import type { AuditRule, FinancialDataset, RuleFormula } from "@/types"

export interface RuleCompileResult {
  formulaAvailable: boolean
  formula?: RuleFormula
  aiEvaluationRequired: boolean
  summary: string
}

export async function compileRuleForDataset(rule: AuditRule, dataset: FinancialDataset): Promise<RuleCompileResult> {
  const response = await fetch("/api/ai/rule-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rule, dataset }),
  })

  const payload = (await response.json()) as Partial<RuleCompileResult> & { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? "Could not compile audit rule.")
  }

  return {
    formulaAvailable: Boolean(payload.formulaAvailable),
    formula: payload.formula,
    aiEvaluationRequired: Boolean(payload.aiEvaluationRequired),
    summary: payload.summary ?? "Rule compile completed.",
  }
}
