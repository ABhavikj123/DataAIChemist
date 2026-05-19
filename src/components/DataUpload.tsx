"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Trash2, UploadCloud } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { createSampleDataset, parseFinancialFile } from "@/lib/file-handler"
import {
  deleteDataset,
  getDatasets,
  getRules,
  getScenario,
  getValidationIssues,
  saveDataset,
  saveRules,
  saveValidationIssues,
} from "@/lib/indexeddb"
import { getQualityScore, validateDatasets } from "@/lib/validation"
import { appActions, useAppStore } from "@/store"
import type { FinancialDataset } from "@/types"

export default function DataUpload() {
  const { datasets, rules, validationIssues, isLoading } = useAppStore((state) => ({
    datasets: state.datasets,
    rules: state.rules,
    validationIssues: state.validationIssues,
    isLoading: state.isLoading,
  }))
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const qualityScore = useMemo(() => getQualityScore(datasets, validationIssues), [datasets, validationIssues])

  useEffect(() => {
    async function hydrate() {
      const [storedDatasets, storedIssues, storedRules, storedScenario] = await Promise.all([
        getDatasets(),
        getValidationIssues(),
        getRules(),
        getScenario(),
      ])
      appActions.setDatasets(storedDatasets.reverse())
      appActions.setValidationIssues(storedIssues)
      appActions.setRules(storedRules)
      if (storedScenario) appActions.setScenario(storedScenario)
    }

    hydrate().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load browser database."))
  }, [])

  const refreshValidation = useCallback(
    async (nextDatasets: FinancialDataset[] = datasets) => {
      const issues = validateDatasets(nextDatasets, rules)
      await saveValidationIssues(issues)
      appActions.setValidationIssues(issues)
      return issues
    },
    [datasets, rules],
  )

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const accepted = Array.from(files)
      if (accepted.length === 0) return

      setError("")
      setMessage("")
      setProgress(5)
      appActions.setLoading(true)

      try {
        const rejected: string[] = []
        const parsed: FinancialDataset[] = []
        for (const [index, file] of accepted.entries()) {
          if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
            rejected.push(file.name)
            continue
          }

          const dataset = await parseFinancialFile(file)
          await saveDataset(dataset)
          appActions.upsertDataset(dataset)
          parsed.push(dataset)
          setProgress(Math.round(((index + 1) / accepted.length) * 75))
        }

        const latestDatasets = (await getDatasets()).reverse()
        appActions.setDatasets(latestDatasets)
        await refreshValidation(latestDatasets)
        setProgress(100)
        setMessage(
          `${parsed.length} file${parsed.length === 1 ? "" : "s"} ingested.${
            rejected.length ? ` Rejected unsupported files: ${rejected.join(", ")}.` : ""
          }`,
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.")
      } finally {
        appActions.setLoading(false)
      }
    },
    [refreshValidation],
  )

  async function loadSampleData() {
    setError("")
    setMessage("")
    appActions.setLoading(true)
    try {
      const dataset = await createSampleDataset()
      await saveDataset(dataset)
      appActions.upsertDataset(dataset)
      const latestDatasets = (await getDatasets()).reverse()
      appActions.setDatasets(latestDatasets)
      await refreshValidation(latestDatasets)
      setMessage("Sample FinOps ledger loaded for testing ingestion, grid editing, rules, validation, scenario planning, and export.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample data could not be loaded.")
    } finally {
      appActions.setLoading(false)
    }
  }

  async function removeDataset(datasetId: string) {
    await deleteDataset(datasetId)
    appActions.removeDataset(datasetId)
    const nextDatasets = datasets.filter((dataset) => dataset.id !== datasetId)
    const nextRules = rules.map((rule) => ({
      ...rule,
      targetDatasetIds: rule.targetDatasetIds.filter((id) => id !== datasetId),
    }))
    await saveRules(nextRules)
    appActions.setRules(nextRules)
    await refreshValidation(nextDatasets)
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">Data Ingestion Terminal</h1>
          <p className="mt-1 text-sm text-slate-600">Drop any number of ledgers, budgets, vendor exports, or forecasts.</p>
        </div>
        <Button variant="outline" onClick={loadSampleData} disabled={isLoading}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Load sample file
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-md border border-slate-200 bg-white px-4 py-2">
          <div className="font-semibold text-slate-950">{datasets.length}</div>
          <div className="text-xs text-slate-500">datasets</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-2">
          <div className="font-semibold text-slate-950">{datasets.reduce((sum, item) => sum + item.rows.length, 0)}</div>
          <div className="text-xs text-slate-500">rows</div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-4 py-2">
          <div className="font-semibold text-slate-950">{qualityScore}%</div>
          <div className="text-xs text-slate-500">quality</div>
        </div>
      </div>

      <label
        className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-white p-8 text-center transition hover:border-slate-500 hover:bg-slate-50"
        onDrop={(event) => {
          event.preventDefault()
          processFiles(event.dataTransfer.files)
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        {isLoading ? <Loader2 className="h-10 w-10 animate-spin text-slate-500" /> : <UploadCloud className="h-10 w-10 text-slate-500" />}
        <span className="mt-4 text-base font-semibold text-slate-950">Drop financial files here</span>
        <span className="mt-1 text-sm text-slate-500">CSV, XLSX, and XLS files are parsed into IndexedDB asynchronously.</span>
        <input type="file" multiple accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => processFiles(event.target.files ?? [])} />
      </label>

      {isLoading && <Progress value={progress} />}
      {message && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {datasets.map((dataset) => {
          const issues = validationIssues.filter((issue) => issue.datasetId === dataset.id)
          return (
            <Card key={dataset.id} className="rounded-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{dataset.name}</span>
                  </span>
                  <Badge variant={issues.some((issue) => issue.severity === "error") ? "destructive" : "secondary"}>{dataset.type}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="font-semibold text-slate-950">{dataset.rows.length}</div>
                  <div className="text-xs text-slate-500">rows</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-950">{dataset.headers.length}</div>
                  <div className="text-xs text-slate-500">columns</div>
                </div>
                <div>
                  <div className={issues.length ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>{issues.length}</div>
                  <div className="text-xs text-slate-500">issues</div>
                </div>
                <Button variant="outline" size="sm" className="col-span-3" onClick={() => removeDataset(dataset.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove dataset
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
