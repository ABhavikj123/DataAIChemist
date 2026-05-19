import Papa from "papaparse"
import * as XLSX from "xlsx"
import type { DataRow, DataValue, DatasetType, FinancialDataset, SchemaMapping } from "@/types"
import { detectDatasetType, validateDatasets } from "@/lib/validation"

function normalizeHeader(header: string, index: number): string {
  const trimmed = header.trim()
  return trimmed.length > 0 ? trimmed : `Column ${index + 1}`
}

function normalizeValue(value: unknown): DataValue {
  if (value === undefined || value === null) return null
  if (typeof value === "number" || typeof value === "boolean") return value
  const text = String(value).trim()
  if (text === "") return null
  const normalizedNumber = Number(text.replace(/[$,%]/g, ""))
  if (/^-?\$?\d[\d,]*(\.\d+)?%?$/.test(text) && Number.isFinite(normalizedNumber)) {
    return normalizedNumber
  }
  return text
}

function readFileContent(file: File): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result ?? "")
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))

    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

function parseCSV(content: string): Promise<DataRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
      transform: normalizeValue,
      complete: (result) => resolve(result.data.map((row) => ({ ...row } as DataRow))),
      error: (error: Error) => reject(error),
    })
  })
}

function parseWorkbook(content: ArrayBuffer): DataRow[] {
  const workbook = XLSX.read(content, { type: "array" })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) return []

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], { header: 1, blankrows: false })
  const headers = (rows[0] ?? []).map((header, index) => normalizeHeader(String(header ?? ""), index))

  return rows.slice(1).map((row) => {
    const record: DataRow = {}
    headers.forEach((header, index) => {
      record[header] = normalizeValue(row[index])
    })
    return record
  })
}

export async function parseFinancialFile(file: File): Promise<FinancialDataset> {
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    throw new Error("Only CSV, XLSX, and XLS files are supported.")
  }

  const content = await readFileContent(file)
  const rows = file.name.toLowerCase().endsWith(".csv") ? await parseCSV(content as string) : parseWorkbook(content as ArrayBuffer)
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const now = new Date().toISOString()
  const type: DatasetType = detectDatasetType(headers, file.name)

  const dataset: FinancialDataset = {
    id: `${crypto.randomUUID()}`,
    name: file.name.replace(/\.(csv|xlsx|xls)$/i, ""),
    fileName: file.name,
    type,
    status: rows.length > 0 ? "ready" : "error",
    headers,
    rows,
    schemaMapping: inferSchemaMapping(headers),
    appliedRuleIds: [],
    createdAt: now,
    updatedAt: now,
    metadata: {
      size: file.size,
      mimeType: file.type || "application/octet-stream",
      source: "upload",
    },
  }

  validateDatasets([dataset])
  return dataset
}

export async function createSampleDataset(): Promise<FinancialDataset> {
  const response = await fetch("/finops-sample.csv")
  if (!response.ok) throw new Error("Sample data file could not be loaded.")
  const rows = await parseCSV(await response.text())
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name: "FinOps sample ledger",
    fileName: "finops-sample.csv",
    type: "ledger",
    status: "ready",
    headers,
    rows,
    schemaMapping: inferSchemaMapping(headers),
    appliedRuleIds: [],
    createdAt: now,
    updatedAt: now,
    metadata: {
      size: rows.length,
      mimeType: "text/csv",
      source: "sample",
    },
  }
}

export function inferSchemaMapping(headers: string[]): SchemaMapping {
  const find = (patterns: string[]) =>
    headers.find((header) => {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, "")
      return patterns.some((pattern) => normalized.includes(pattern))
    })

  return {
    Amount: find(["amount", "cost", "total", "expense", "value", "actual"]),
    Date: find(["date", "period", "month"]),
    Vendor: find(["vendor", "supplier", "merchant"]),
    Account: find(["account", "glcode", "code", "category"]),
    Description: find(["description", "memo", "notes"]),
  }
}

export function exportToCSV(data: DataRow[], filename: string): void {
  const csv = Papa.unparse(data)
  downloadBlob(csv, filename, "text/csv;charset=utf-8")
}

export function exportToJSON(data: unknown, filename: string): void {
  downloadBlob(JSON.stringify(data, null, 2), filename, "application/json")
}

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
