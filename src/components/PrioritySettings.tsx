"use client"

import { useMemo, useState } from "react"
import { Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { saveScenario } from "@/lib/indexeddb"
import { appActions, useAppStore } from "@/store"
import type { DataValue } from "@/types"

function safeParseMoney(value: DataValue): number {
  if (value === null || value === "") return 0
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""))
  return Number.isNaN(parsed) ? 0 : parsed
}

export default function PrioritySettings() {
  const { datasets, scenario } = useAppStore((state) => ({ datasets: state.datasets, scenario: state.scenario }))
  const [cashReservesInput, setCashReservesInput] = useState<string>("")

  const defaultCashReserves = useMemo(() => {
    if (datasets.length === 0) return 0

    return datasets.reduce((datasetSum, dataset) => {
      const amountColumn =
        dataset.schemaMapping.Amount ??
        dataset.headers.find((header) => /amount|cost|total|expense|actual|value/i.test(header))

      if (!amountColumn) return datasetSum

      return (
        datasetSum +
        dataset.rows.reduce((rowSum, row) => {
          const parsed = safeParseMoney(row[amountColumn])
          return rowSum + Math.abs(parsed)
        }, 0)
      )
    }, 0)
  }, [datasets])

  const activeCashReserves = cashReservesInput.trim() ? Math.max(0, parseFloat(cashReservesInput)) : defaultCashReserves

  const dynamicRevenueBaseline = useMemo(() => {
    if (datasets.length === 0) return 0

    let maxValue = 0
    datasets.forEach((dataset) => {
      const amountColumn =
        dataset.schemaMapping.Amount ??
        dataset.headers.find((header) => /amount|cost|total|expense|actual|value/i.test(header))

      if (!amountColumn) return

      dataset.rows.forEach((row) => {
        const parsed = Math.abs(safeParseMoney(row[amountColumn]))
        if (parsed > maxValue) maxValue = parsed
      })
    })

    return maxValue > 0 ? maxValue : 0
  }, [datasets])

  const baselineExpense = useMemo(() => {
    if (datasets.length === 0) return 0

    return datasets.reduce((datasetSum, dataset) => {
      const amountColumn =
        dataset.schemaMapping.Amount ??
        dataset.headers.find((header) => /amount|cost|total|expense|actual|value/i.test(header))

      if (!amountColumn) return datasetSum

      return (
        datasetSum +
        dataset.rows.reduce((rowSum, row) => {
          const parsed = safeParseMoney(row[amountColumn])
          return rowSum + Math.abs(parsed)
        }, 0)
      )
    }, 0)
  }, [datasets])

  const impact = useMemo(() => {
    if (datasets.length === 0) {
      return {
        projectedRevenue: 0,
        currentExpenseBase: 0,
        grossMargin: 0,
        runway: "—",
      }
    }

    const projectedRevenue = dynamicRevenueBaseline * (1 + scenario.revenueGrowth / 100)

    const cutExpenseBase = baselineExpense * (1 - scenario.expenseCut / 100)
    const currentExpenseBase = cutExpenseBase * (1 + scenario.headcountBuffer / 100)

    const grossMargin = projectedRevenue > 0 ? ((projectedRevenue - currentExpenseBase) / projectedRevenue) * 100 : 0

    let runway: string
    if (currentExpenseBase === 0) {
      runway = "∞"
    } else if (currentExpenseBase > projectedRevenue) {
      const monthlyBurnRate = (currentExpenseBase - projectedRevenue) / 12
      const runwayMonths = activeCashReserves / monthlyBurnRate
      runway = Number.isFinite(runwayMonths) ? `${runwayMonths.toFixed(1)}` : "∞"
    } else {
      const monthlyExpenseRate = currentExpenseBase / 12
      const runwayMonths = activeCashReserves / monthlyExpenseRate
      runway = Number.isFinite(runwayMonths) ? `${runwayMonths.toFixed(1)}` : "∞"
    }

    return {
      projectedRevenue,
      currentExpenseBase,
      grossMargin: Number.isFinite(grossMargin) ? grossMargin : 0,
      runway,
    }
  }, [baselineExpense, dynamicRevenueBaseline, datasets.length, scenario, activeCashReserves])

  async function updateScenario(key: keyof typeof scenario, value: number[]) {
    const next = { ...scenario, [key]: value[0] }
    appActions.setScenario(next)
    await saveScenario(next)
  }

  return (
    <section className="space-y-6 p-4 md:p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Scenario Planner</h1>
          <p className="mt-1 text-sm text-slate-600">All metrics derived dynamically from your active dataset and simulation inputs.</p>
        </div>
        <Button variant="outline" onClick={() => saveScenario(scenario)}>
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Simulation controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-7">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-950">Starting Cash Reserves ($)</label>
              <Input
                type="number"
                value={cashReservesInput}
                onChange={(e) => setCashReservesInput(e.target.value)}
                placeholder={`Default: $${Math.round(defaultCashReserves).toLocaleString()}`}
                className="h-10"
              />
              {!cashReservesInput.trim() && (
                <p className="text-xs text-slate-500">Using dataset sum: ${Math.round(defaultCashReserves).toLocaleString()}</p>
              )}
            </div>
            <ScenarioSlider label="Revenue Growth %" value={scenario.revenueGrowth} min={-25} max={50} onChange={(value) => updateScenario("revenueGrowth", value)} />
            <ScenarioSlider label="Operating Expense Cut %" value={scenario.expenseCut} min={0} max={40} onChange={(value) => updateScenario("expenseCut", value)} />
            <ScenarioSlider label="Headcount Buffering %" value={scenario.headcountBuffer} min={0} max={30} onChange={(value) => updateScenario("headcountBuffer", value)} />
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>Projected impact</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Metric label="Revenue baseline" value={`$${Math.round(dynamicRevenueBaseline).toLocaleString()}`} />
            <Metric label="Projected revenue" value={`$${Math.round(impact.projectedRevenue).toLocaleString()}`} />
            <Metric label="Expense base" value={`$${Math.round(impact.currentExpenseBase).toLocaleString()}`} />
            <Metric label="Gross margin" value={`${Math.round(impact.grossMargin)}%`} />
            <Metric label="Cash reserves" value={`$${Math.round(activeCashReserves).toLocaleString()}`} />
            <Metric label="Runway" value={`${impact.runway} mo`} />
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function ScenarioSlider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number[]) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-950">{label}</span>
        <span className="font-mono text-slate-600">{value}%</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={onChange} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    </div>
  )
}
