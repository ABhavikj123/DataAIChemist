import Papa from "papaparse"
import * as XLSX from "xlsx"
import { parseColumnMapping } from "./gemini"
import type { Client, Worker, Task } from "@/types"

function readFileContent(file: File): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result || "")
    reader.onerror = () => reject(new Error("Failed to read file"))

    if (file.name.endsWith(".csv")) {
      reader.readAsText(file)
    } else {
      reader.readAsArrayBuffer(file)
    }
  })
}

function parseCSV(content: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => {
        if (!isNaN(Number(value)) && value.trim() !== "") {
          return Number(value)
        }
        return value.trim()
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV parsing warnings:", results.errors)
        }
        resolve(results.data)
      },
      error: (error: Error) => reject(error),
    })
  })
}

function parseXLSX(content: ArrayBuffer): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    try {
      const workbook = XLSX.read(content, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (data.length === 0) {
        resolve([])
        return
      }

      const headers = data[0] as string[]
      const rows = data.slice(1) as unknown[][]

      const objects = rows.map((row) => {
        const obj: Record<string, unknown> = {}
        headers.forEach((header, index) => {
          obj[header] = row[index]
        })
        return obj
      })

      resolve(objects)
    } catch (error) {
      reject(error)
    }
  })
}

export async function parseFile<T extends Record<string, unknown>>(file: File, expectedFields: string[]): Promise<T[]> {
  const fileContent = await readFileContent(file)
  let data: Record<string, unknown>[]

  if (file.name.endsWith(".csv")) {
    data = await parseCSV(fileContent as string)
  } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
    data = await parseXLSX(fileContent as ArrayBuffer)
  } else {
    throw new Error("Unsupported file format. Please upload CSV or XLSX files.")
  }

  if (data.length > 0) {
    const headers = Object.keys(data[0])
    const columnMapping = await parseColumnMapping(headers, expectedFields)

    data = data.map((row) => {
      const mappedRow: Record<string, unknown> = {}
      expectedFields.forEach((field) => {
        const sourceField = columnMapping[field]
        if (sourceField && row[sourceField] !== undefined) {
          mappedRow[field] = row[sourceField]
        }
      })
      return mappedRow
    })
  }

  return data as T[]
}

export async function loadSampleData(): Promise<{ clients: Client[]; workers: Worker[]; tasks: Task[] }> {
  try {
    const [clientsResponse, workersResponse, tasksResponse] = await Promise.all([
      fetch("/clients.csv"),
      fetch("/workers.csv"),
      fetch("/tasks.csv"),
    ])

    if (!clientsResponse.ok || !workersResponse.ok || !tasksResponse.ok) {
      throw new Error("Failed to fetch sample data files")
    }

    const [clientsCSV, workersCSV, tasksCSV] = await Promise.all([
      clientsResponse.text(),
      workersResponse.text(),
      tasksResponse.text(),
    ])

    const [clientsData, workersData, tasksData] = await Promise.all([
      parseCSV(clientsCSV),
      parseCSV(workersCSV),
      parseCSV(tasksCSV),
    ])

    return {
      clients: clientsData as unknown as Client[],
      workers: workersData as unknown as Worker[],
      tasks: tasksData as unknown as Task[],
    }
  } catch (error) {
    console.error("Failed to load sample data:", error)
    throw error
  }
}

export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string): void {
  const csv = Papa.unparse(data)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)
  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
