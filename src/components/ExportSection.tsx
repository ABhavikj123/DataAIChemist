"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { exportToCSV, exportToJSON } from "@/lib/file-handler"
import { useAppStore } from "@/store"

export default function ExportSection() {
  const { datasets, rules, scenario, validationIssues } = useAppStore((state) => ({
    datasets: state.datasets,
    rules: state.rules,
    scenario: state.scenario,
    validationIssues: state.validationIssues,
  }))

  function exportManifest() {
    exportToJSON(
      {
        exportedAt: new Date().toISOString(),
        datasets: datasets.map(({ id, name, fileName, type, headers, rows }) => ({ id, name, fileName, type, headers, rows })),
        validationIssues,
        rules,
        scenario,
      },
      "abacum-finops-export.json",
    )
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Final Clean Accounting Export</h1>
        <p className="mt-1 text-sm text-slate-600">Export clean datasets, audit configuration, and validation evidence.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {datasets.map((dataset) => (
          <Card key={dataset.id} className="rounded-md">
            <CardHeader>
              <CardTitle className="text-base">{dataset.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-slate-600">
                {dataset.rows.length} rows, {dataset.headers.length} columns, {dataset.type}
              </div>
              <Button variant="outline" className="w-full" onClick={() => exportToCSV(dataset.rows, `${dataset.name}-clean.csv`)}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Workspace export</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row">
          <Button onClick={exportManifest}>
            <Download className="mr-2 h-4 w-4" />
            Export full JSON package
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
