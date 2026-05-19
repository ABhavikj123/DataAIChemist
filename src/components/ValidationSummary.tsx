"use client"

import { useMemo } from "react"
import { AlertTriangle, CheckCircle2, RefreshCw, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { saveValidationIssues } from "@/lib/indexeddb"
import { getQualityScore, validateDatasets } from "@/lib/validation"
import { appActions, useAppStore } from "@/store"

interface ValidationSummaryProps {
  onOpenGrid: () => void
}

export default function ValidationSummary({ onOpenGrid }: ValidationSummaryProps) {
  const { datasets, rules, validationIssues } = useAppStore((state) => ({
    datasets: state.datasets,
    rules: state.rules,
    validationIssues: state.validationIssues,
  }))
  const errors = validationIssues.filter((issue) => issue.severity === "error")
  const warnings = validationIssues.filter((issue) => issue.severity === "warning")
  const ruleBreaks = validationIssues.filter((issue) => issue.source === "rule")
  const score = useMemo(() => getQualityScore(datasets, validationIssues), [datasets, validationIssues])
  const grouped = useMemo(
    () =>
      datasets.map((dataset) => ({
        dataset,
        issues: validationIssues.filter((issue) => issue.datasetId === dataset.id),
      })),
    [datasets, validationIssues],
  )

  async function runValidation() {
    const issues = validateDatasets(datasets, rules)
    await saveValidationIssues(issues)
    appActions.setValidationIssues(issues)
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Data Validation Console</h1>
          <p className="mt-1 text-sm text-slate-600">Structural issues grouped by uploaded file with cell-level repair links.</p>
        </div>
        <Button onClick={runValidation}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Run Validation
        </Button>
      </div>

      <Card className="rounded-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Breaking Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ruleBreaks.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              No audit rule breaks detected.
            </div>
          ) : (
            ruleBreaks.map((issue) => (
              <button
                key={issue.id}
                className="grid w-full gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-left text-sm hover:bg-red-100 md:grid-cols-[1fr_120px_160px_1fr]"
                onClick={() => {
                  if (issue.rowIndex === undefined || !issue.field) return
                  appActions.setActiveDatasetId(issue.datasetId)
                  appActions.setFocusTarget({ datasetId: issue.datasetId, rowIndex: issue.rowIndex, field: issue.field })
                  onOpenGrid()
                }}
              >
                <span className="font-medium text-red-900">{issue.datasetName}</span>
                <span>Row {issue.rowIndex !== undefined ? issue.rowIndex + 1 : "-"}</span>
                <span>{issue.field ?? "-"}</span>
                <span>{issue.ruleName ?? issue.message}</span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-md">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-500">Data Quality Score</div>
                <div className="mt-1 text-3xl font-semibold">{score}%</div>
              </div>
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <Progress value={score} className="mt-4" />
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm text-slate-500">Errors</div>
              <div className="mt-1 text-3xl font-semibold text-red-600">{errors.length}</div>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </CardContent>
        </Card>
        <Card className="rounded-md">
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <div className="text-sm text-slate-500">Warnings</div>
              <div className="mt-1 text-3xl font-semibold text-amber-600">{warnings.length}</div>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-600" />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {grouped.map(({ dataset, issues }) => (
          <Card key={dataset.id} className="rounded-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{dataset.name}</span>
                <Badge variant={issues.some((issue) => issue.severity === "error") ? "destructive" : "secondary"}>
                  {issues.length} issues
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {issues.length === 0 ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                  No structural issues found.
                </div>
              ) : (
                issues.map((issue) => (
                  <button
                    key={issue.id}
                    className="flex w-full items-start justify-between gap-4 rounded-md border border-slate-200 p-3 text-left hover:bg-slate-50"
                    onClick={() => {
                      if (issue.rowIndex === undefined || !issue.field) return
                      appActions.setActiveDatasetId(issue.datasetId)
                      appActions.setFocusTarget({ datasetId: issue.datasetId, rowIndex: issue.rowIndex, field: issue.field })
                      onOpenGrid()
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-950">{issue.message}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {issue.rowIndex !== undefined ? `Row ${issue.rowIndex + 1}` : "Dataset"} {issue.field ? `- ${issue.field}` : ""}
                      </span>
                    </span>
                    <Badge variant={issue.severity === "error" ? "destructive" : "secondary"}>{issue.severity}</Badge>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
