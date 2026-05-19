"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { saveRules, saveValidationIssues } from "@/lib/indexeddb"
import { validateDatasets } from "@/lib/validation"
import { appActions, useAppStore } from "@/store"
import type { AuditRule } from "@/types"

const operators: AuditRule["operator"][] = [
  "required", 
  "equal", 
  "not_equal", 
  "contains", 
  "does_not_contain", 
  "starts_with", 
  "ends_with", 
  "positive", 
  "negative", 
  "greater_than", 
  "less_than", 
  "json", 
  "uppercase", 
  "lowercase"
];

export default function RulesEditor() {
  const { datasets, rules } = useAppStore((state) => ({ datasets: state.datasets, rules: state.rules }))
  const allFields = useMemo(() => Array.from(new Set(datasets.flatMap((dataset) => dataset.headers))), [datasets])
  const [draft, setDraft] = useState({
    name: "",
    field: allFields[0] ?? "",
    operator: "required" as AuditRule["operator"],
    expectedValue: "",
  })

  async function persist(nextRules: AuditRule[]) {
    await saveRules(nextRules)
    const issues = validateDatasets(datasets, nextRules)
    await saveValidationIssues(issues)
    appActions.setRules(nextRules)
    appActions.setValidationIssues(issues)
  }

  async function createRule() {
    if (!draft.name.trim() || !draft.field) return
    const rule: AuditRule = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      description: `${draft.field} must satisfy ${draft.operator}${draft.expectedValue ? ` ${draft.expectedValue}` : ""}.`,
      field: draft.field,
      operator: draft.operator,
      expectedValue: draft.expectedValue || undefined,
      targetDatasetIds: [],
      formulaAvailable: false,
      aiEvaluationRequired: true,
      active: true,
      createdAt: new Date().toISOString(),
    }
    await persist([...rules, rule])
    setDraft({ ...draft, name: "", expectedValue: "" })
  }

  async function toggleRule(rule: AuditRule) {
    await persist(rules.map((item) => (item.id === rule.id ? { ...rule, active: !rule.active } : item)))
  }

  async function removeRule(id: string) {
    await persist(rules.filter((rule) => rule.id !== id))
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Custom Data Auditing Controls</h1>
        <p className="mt-1 text-sm text-slate-600">Create reusable rules here, then apply them to the selected file from Financial Ledger.</p>
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>New audit rule</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_180px_1fr_auto]">
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Rule name" />
          <Select value={draft.field} onValueChange={(field) => setDraft({ ...draft, field })}>
            <SelectTrigger>
              <SelectValue placeholder="Field" />
            </SelectTrigger>
            <SelectContent>
              {allFields.map((field) => (
                <SelectItem key={field} value={field}>
                  {field}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={draft.operator} onValueChange={(operator: AuditRule["operator"]) => setDraft({ ...draft, operator })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((operator) => (
                <SelectItem key={operator} value={operator}>
                  {operator}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={draft.expectedValue} onChange={(event) => setDraft({ ...draft, expectedValue: event.target.value })} placeholder="Expected text" />
          <Button onClick={createRule} disabled={!draft.name.trim() || !draft.field}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {rules.map((rule) => (
          <Card key={rule.id} className="rounded-md">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-slate-950">{rule.name}</div>
                <div className="mt-1 text-sm text-slate-500">{rule.description}</div>
                <div className="mt-2 text-xs text-slate-500">
                  {rule.formulaAvailable ? `Saved formula: ${rule.formula?.field} ${rule.formula?.operator}` : "Formula not compiled yet"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={rule.active} onCheckedChange={() => toggleRule(rule)} />
                <Button variant="ghost" size="sm" onClick={() => removeRule(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
