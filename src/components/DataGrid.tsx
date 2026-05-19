"use client"

import { useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, Download, Loader2, Save, ShieldCheck, Sparkles, Wand2, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { exportToCSV } from "@/lib/file-handler"
import { saveDataset, saveRules, saveValidationIssues } from "@/lib/indexeddb"
import { correctDatasetWithGemini } from "@/lib/gemini"
import { compileRuleForDataset } from "@/lib/rule-compiler"
import { updateCell, validateDatasets } from "@/lib/validation"
import { appActions, useAppStore } from "@/store"

type EditingCell = { rowIndex: number; field: string } | null

export default function DataGrid() {
  const { activeDatasetId, datasets, focusTarget, rules, validationIssues } = useAppStore((state) => ({
    activeDatasetId: state.activeDatasetId,
    datasets: state.datasets,
    focusTarget: state.focusTarget,
    rules: state.rules,
    validationIssues: state.validationIssues,
  }))
  const [editingCell, setEditingCell] = useState<EditingCell>(null)
  const [editValue, setEditValue] = useState("")
  const [instruction, setInstruction] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isCorrecting, setIsCorrecting] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [applyingRuleId, setApplyingRuleId] = useState<string | null>(null)

  const activeDataset = useMemo(
    () => datasets.find((dataset) => dataset.id === activeDatasetId) ?? datasets[0],
    [activeDatasetId, datasets],
  )

  const activeIssues = useMemo(
    () => validationIssues.filter((issue) => issue.datasetId === activeDataset?.id),
    [activeDataset?.id, validationIssues],
  )

  async function persistRows(rows: typeof activeDataset.rows) {
    if (!activeDataset) return
    const updatedDataset = { ...activeDataset, rows, updatedAt: new Date().toISOString() }
    await saveDataset(updatedDataset)
    appActions.updateDatasetRows(activeDataset.id, rows)
    const nextDatasets = datasets.map((dataset) => (dataset.id === activeDataset.id ? updatedDataset : dataset))
    const issues = validateDatasets(nextDatasets, rules)
    await saveValidationIssues(issues)
    appActions.setValidationIssues(issues)
  }

  async function applyRule(ruleId: string) {
    if (!activeDataset) return
    const rule = rules.find((item) => item.id === ruleId)
    if (!rule) return

    setApplyingRuleId(ruleId)
    setError("")
    setNotice("")

    let compiledRule = rule
    if (!rule.formulaAvailable || !rule.formula || rule.aiEvaluationRequired) {
      try {
        const result = await compileRuleForDataset(rule, activeDataset)
        compiledRule = {
          ...rule,
          formulaAvailable: result.formulaAvailable,
          formula: result.formula,
          aiEvaluationRequired: result.aiEvaluationRequired,
          compiledAt: new Date().toISOString(),
        }
        setNotice(result.summary)
      } catch (err) {
        setApplyingRuleId(null)
        setError(err instanceof Error ? err.message : "Rule compilation failed.")
        return
      }
    }

    const updatedDataset = {
      ...activeDataset,
      appliedRuleIds: Array.from(new Set([...activeDataset.appliedRuleIds, ruleId])),
      updatedAt: new Date().toISOString(),
    }
    const updatedRules = rules.map((item) =>
      item.id === ruleId
        ? { ...compiledRule, targetDatasetIds: Array.from(new Set([...compiledRule.targetDatasetIds, activeDataset.id])) }
        : item,
    )
    const nextDatasets = datasets.map((dataset) => (dataset.id === activeDataset.id ? updatedDataset : dataset))
    await Promise.all([saveDataset(updatedDataset), saveRules(updatedRules)])
    const issues = validateDatasets(nextDatasets, updatedRules)
    await saveValidationIssues(issues)
    appActions.updateDataset(updatedDataset)
    appActions.setRules(updatedRules)
    appActions.setValidationIssues(issues)
    const breakCount = issues.filter((issue) => issue.datasetId === activeDataset.id && issue.ruleId === ruleId).length
    setNotice(`${compiledRule.name} applied to ${activeDataset.name}. ${breakCount} row${breakCount === 1 ? "" : "s"} breaking this rule.`)
    setApplyingRuleId(null)
  }

  async function updateAmountMapping(sourceColumn: string) {
    if (!activeDataset) return
    const updatedDataset = {
      ...activeDataset,
      schemaMapping: { ...activeDataset.schemaMapping, Amount: sourceColumn },
      updatedAt: new Date().toISOString(),
    }
    await saveDataset(updatedDataset)
    appActions.updateDataset(updatedDataset)
    setNotice(`Amount is now mapped to ${sourceColumn}.`)
  }

  async function saveEdit() {
    if (!activeDataset || !editingCell) return
    await persistRows(updateCell(activeDataset.rows, editingCell.rowIndex, editingCell.field, editValue))
    setEditingCell(null)
    setEditValue("")
  }

  async function applyCorrection(rowIndex?: number, field?: string, overrideInstruction?: string) {
    if (!activeDataset) return
    const prompt = (overrideInstruction ?? instruction).trim()
    if (!prompt) {
      setError("Add a correction instruction first.")
      return
    }

    setIsCorrecting(true)
    setError("")
    setNotice("")
    try {
      const result = await correctDatasetWithGemini({ dataset: activeDataset, instruction: prompt, rowIndex, field })
      await persistRows(result.rows)
      setNotice(result.summary)
      setInstruction("")
      setDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI correction failed.")
    } finally {
      setIsCorrecting(false)
    }
  }

  if (!activeDataset) {
    return (
      <section className="p-6">
        <Card className="rounded-md">
          <CardContent className="p-10 text-center text-slate-500">Upload a financial file to open the ledger grid.</CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Interactive Financial Ledger</h1>
          <p className="mt-1 text-sm text-slate-600">Double-click a cell to edit it. Corrections persist to IndexedDB immediately.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Wand2 className="mr-2 h-4 w-4" />
                AI Correct Data
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-md">
              <DialogHeader>
                <DialogTitle>Batch data correction</DialogTitle>
              </DialogHeader>
              <Textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Standardize account codes to uppercase, trim text fields, and wrap invalid JSON as a message object."
                rows={5}
              />
              <Button onClick={() => applyCorrection()} disabled={isCorrecting || !instruction.trim()}>
                {isCorrecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Apply to {activeDataset.name}
              </Button>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => exportToCSV(activeDataset.rows, `${activeDataset.name}-clean.csv`)}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Tabs value={activeDataset.id} onValueChange={(value) => appActions.setActiveDatasetId(value)}>
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          {datasets.map((dataset) => (
            <TabsTrigger key={dataset.id} value={dataset.id} className="gap-2">
              {dataset.name}
              <Badge variant="secondary">{dataset.rows.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {notice && (
        <Alert>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertDescription className="leading-relaxed">
              {notice}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <AlertDescription className="leading-relaxed">
              {error}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {rules.length > 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-slate-950">
                Apply audit rules
              </div>
              <div className="text-xs text-slate-500">
                Rules compile once, save locally, then validate this file instantly.
              </div>
            </div>

            <Badge variant="outline">
              {activeDataset.appliedRuleIds.length} active
            </Badge>
          </div>

          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <div className="text-xs font-semibold text-red-700">
              Applied rules cannot be removed.
            </div>

            <div className="mt-1 text-xs leading-relaxed text-red-600">
              Once a rule is applied to this dataset, it becomes permanent for the
              uploaded file. To change applied rules, you must drop and upload the
              file again. Apply rules carefully.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {rules.map((rule) => {
              const applied = activeDataset.appliedRuleIds.includes(rule.id)

              const breakCount = activeIssues.filter(
                (issue) => issue.ruleId === rule.id
              ).length

              return (
                <Button
                  key={rule.id}
                  size="sm"
                  variant={applied ? "secondary" : "outline"}
                  disabled={
                    Boolean(applyingRuleId) || applied || !rule.active
                  }
                  onClick={() => applyRule(rule.id)}
                  className="h-8"
                >
                  {applyingRuleId === rule.id ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                  )}

                  {rule.name}

                  {applied && (
                    <span className="ml-2 text-xs">
                      {breakCount} breaks
                    </span>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <Card className="rounded-md">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium text-slate-950">Schema mapping</div>
            <div className="text-sm text-slate-500">Scenario Planner reads this saved Amount mapping for calculations.</div>
          </div>
          <div className="w-full md:w-72">
            <Select value={activeDataset.schemaMapping.Amount ?? ""} onValueChange={updateAmountMapping}>
              <SelectTrigger>
                <SelectValue placeholder="Choose Amount source column" />
              </SelectTrigger>
              <SelectContent>
                {activeDataset.headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="font-medium text-slate-950">{activeDataset.fileName}</div>
          <div className="flex gap-2 text-sm">
            <Badge variant="outline">{activeDataset.type}</Badge>
            <Badge variant={activeIssues.some((issue) => issue.severity === "error") ? "destructive" : "secondary"}>
              {activeIssues.length} issues
            </Badge>
          </div>
        </div>

        <div className="max-h-[68vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 w-16 bg-white">#</TableHead>
                {activeDataset.headers.map((header) => (
                  <TableHead key={header} className="min-w-44 whitespace-nowrap">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeDataset.rows.map((row, rowIndex) => (
                <TableRow key={`${activeDataset.id}-${rowIndex}`}>
                  <TableCell className="sticky left-0 bg-white font-mono text-xs text-slate-500">{rowIndex + 1}</TableCell>
                  {activeDataset.headers.map((field) => {
                    const cellIssues = activeIssues.filter((issue) => issue.rowIndex === rowIndex && issue.field === field)
                    const rowRuleBreaks = activeIssues.some((issue) => issue.source === "rule" && issue.rowIndex === rowIndex)
                    const focused = focusTarget?.datasetId === activeDataset.id && focusTarget.rowIndex === rowIndex && focusTarget.field === field
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell.field === field
                    return (
                      <TableCell
                        key={field}
                        className={`max-w-72 align-top ${cellIssues.length || rowRuleBreaks ? "bg-red-50" : ""} ${focused ? "ring-2 ring-slate-950" : ""}`}
                        onDoubleClick={() => {
                          appActions.setFocusTarget(null)
                          setEditingCell({ rowIndex, field })
                          setEditValue(String(row[field] ?? ""))
                        }}
                      >
                        {isEditing ? (
                          <div className="flex min-w-56 items-center gap-1">
                            <Input value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus />
                            <Button size="sm" variant="ghost" onClick={saveEdit}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingCell(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="group flex items-start justify-between gap-2">
                            <span className="break-words text-sm">{String(row[field] ?? "")}</span>
                            {cellIssues.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 opacity-0 group-hover:opacity-100"
                                onClick={() => applyCorrection(rowIndex, field, `Fix ${field} in this row according to validation issue: ${cellIssues[0].message}`)}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
