"use client"

import { useMemo } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { appActions, useAppStore } from "@/store"
import type { DataRow } from "@/types"

function rowMatches(row: DataRow, query: string): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  const comparator = normalized.match(/^(.+?)\s*(>=|<=|>|<|=|:)\s*(.+)$/)
  if (comparator) {
    const [, fieldName, operator, rawExpected] = comparator
    const key = Object.keys(row).find((field) => field.toLowerCase() === fieldName.trim())
    if (!key) return false
    const value = row[key]
    const actualNumber = Number(value)
    const expectedNumber = Number(rawExpected)
    if (Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)) {
      if (operator === ">") return actualNumber > expectedNumber
      if (operator === "<") return actualNumber < expectedNumber
      if (operator === ">=") return actualNumber >= expectedNumber
      if (operator === "<=") return actualNumber <= expectedNumber
    }
    return String(value ?? "").toLowerCase().includes(rawExpected.trim().toLowerCase())
  }

  return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalized))
}

export default function NaturalSearch() {
  const { activeDatasetId, datasets, searchQuery } = useAppStore((state) => ({
    activeDatasetId: state.activeDatasetId,
    datasets: state.datasets,
    searchQuery: state.searchQuery,
  }))
  const activeDataset = datasets.find((dataset) => dataset.id === activeDatasetId) ?? datasets[0]
  const filteredRows = useMemo(
    () => activeDataset?.rows.filter((row) => rowMatches(row, searchQuery)).slice(0, 200) ?? [],
    [activeDataset?.rows, searchQuery],
  )

  return (
    <section className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">English-to-Filter Query Engine</h1>
        <p className="mt-1 text-sm text-slate-600">Search naturally, or use precise filters like Amount &gt; 5000 and Account Code:rev.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(event) => appActions.setSearchQuery(event.target.value)}
          placeholder="Find failed invoices, amount > 10000, vendor:stripe..."
          className="pl-9"
        />
      </div>

      {activeDataset && (
        <Tabs value={activeDataset.id} onValueChange={(value) => appActions.setActiveDatasetId(value)}>
          <TabsList className="h-auto flex-wrap justify-start">
            {datasets.map((dataset) => (
              <TabsTrigger key={dataset.id} value={dataset.id}>
                {dataset.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600">
          Showing {filteredRows.length} matching rows {activeDataset ? `from ${activeDataset.name}` : ""}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                {(activeDataset?.headers ?? []).map((header) => (
                  <TableHead key={header} className="min-w-44">
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-xs text-slate-500">{index + 1}</TableCell>
                  {(activeDataset?.headers ?? []).map((header) => (
                    <TableCell key={header} className="max-w-72 truncate">
                      {String(row[header] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  )
}
