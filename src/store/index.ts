"use client"

import { useSyncExternalStore } from "react"
import type { AppState, AuditRule, FinancialDataset, GridFocusTarget, ScenarioInputs, ValidationIssue } from "@/types"

const defaultScenario: ScenarioInputs = {
  revenueGrowth: 8,
  expenseCut: 4,
  headcountBuffer: 2,
}

const initialState: AppState = {
  datasets: [],
  activeDatasetId: null,
  validationIssues: [],
  rules: [],
  scenario: defaultScenario,
  isLoading: false,
  searchQuery: "",
  focusTarget: null,
}

type Listener = () => void
type Selector<T> = (state: AppState) => T

let state = initialState
const listeners = new Set<Listener>()

function emit() {
  listeners.forEach((listener) => listener())
}

function setState(updater: Partial<AppState> | ((current: AppState) => AppState)) {
  state = typeof updater === "function" ? updater(state) : { ...state, ...updater }
  emit()
}

function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

export function useAppStore<T>(selector: Selector<T>): T {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => initialState)
  return selector(current)
}

export const appActions = {
  setDatasets(datasets: FinancialDataset[]) {
    setState((current) => ({
      ...current,
      datasets,
      activeDatasetId:
        current.activeDatasetId && datasets.some((dataset) => dataset.id === current.activeDatasetId)
          ? current.activeDatasetId
          : datasets[0]?.id ?? null,
    }))
  },
  upsertDataset(dataset: FinancialDataset) {
    setState((current) => {
      const exists = current.datasets.some((item) => item.id === dataset.id)
      const datasets = exists
        ? current.datasets.map((item) => (item.id === dataset.id ? dataset : item))
        : [dataset, ...current.datasets]
      return {
        ...current,
        datasets,
        activeDatasetId: current.activeDatasetId ?? dataset.id,
      }
    })
  },
  removeDataset(id: string) {
    setState((current) => {
      const datasets = current.datasets.filter((dataset) => dataset.id !== id)
      return {
        ...current,
        datasets,
        activeDatasetId: current.activeDatasetId === id ? datasets[0]?.id ?? null : current.activeDatasetId,
        validationIssues: current.validationIssues.filter((issue) => issue.datasetId !== id),
        rules: current.rules.map((rule) => ({
          ...rule,
          targetDatasetIds: rule.targetDatasetIds.filter((datasetId) => datasetId !== id),
        })),
      }
    })
  },
  updateDataset(dataset: FinancialDataset) {
    setState((current) => ({
      ...current,
      datasets: current.datasets.map((item) => (item.id === dataset.id ? dataset : item)),
    }))
  },
  updateDatasetRows(datasetId: string, rows: FinancialDataset["rows"]) {
    setState((current) => ({
      ...current,
      datasets: current.datasets.map((dataset) =>
        dataset.id === datasetId ? { ...dataset, rows, updatedAt: new Date().toISOString() } : dataset,
      ),
    }))
  },
  setActiveDatasetId(activeDatasetId: string | null) {
    setState({ activeDatasetId })
  },
  setValidationIssues(validationIssues: ValidationIssue[]) {
    setState({ validationIssues })
  },
  setRules(rules: AuditRule[]) {
    setState({ rules })
  },
  addRule(rule: AuditRule) {
    setState((current) => ({ ...current, rules: [...current.rules, rule] }))
  },
  updateRule(rule: AuditRule) {
    setState((current) => ({ ...current, rules: current.rules.map((item) => (item.id === rule.id ? rule : item)) }))
  },
  deleteRule(id: string) {
    setState((current) => ({ ...current, rules: current.rules.filter((rule) => rule.id !== id) }))
  },
  setScenario(scenario: ScenarioInputs) {
    setState({ scenario })
  },
  setLoading(isLoading: boolean) {
    setState({ isLoading })
  },
  setSearchQuery(searchQuery: string) {
    setState({ searchQuery })
  },
  setFocusTarget(focusTarget: GridFocusTarget | null) {
    setState({ focusTarget })
  },
}
