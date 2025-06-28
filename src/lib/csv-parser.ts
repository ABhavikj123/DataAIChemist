import Papa from "papaparse"
import type { Client, Worker, Task } from "@/types"

export function parseCSV<T>(csvContent: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<T>(csvContent, {
      delimiter: ",",
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string): string => header.trim(),
      transform: (value: string): string | number => {
        if (!isNaN(Number(value)) && value.trim() !== "") {
          return Number(value)
        }
        return value.trim()
      },
      complete: (results: Papa.ParseResult<T>) => {
        const blockingErrors = results.errors.filter((e) => e.code !== "UndetectableDelimiter")
        if (blockingErrors.length) {
          reject(new Error(`CSV parsing errors: ${blockingErrors.map((e) => e.message).join(", ")}`))
        } else {
          resolve(results.data as T[])
        }
      },
      error: (error: Error) => {
        reject(error)
      },
    })
  })
}

export async function loadSampleData(): Promise<{ clients: Client[]; workers: Worker[]; tasks: Task[] }> {
  try {
    const [clientsResponse, workersResponse, tasksResponse] = await Promise.all([
      fetch("/clients.csv"),
      fetch("/workers.csv"),
      fetch("/tasks.csv"),
    ])

    const [clientsCSV, workersCSV, tasksCSV] = await Promise.all([
      clientsResponse.text(),
      workersResponse.text(),
      tasksResponse.text(),
    ])

    const [clients, workers, tasks] = await Promise.all([
      parseCSV<Client>(clientsCSV),
      parseCSV<Worker>(workersCSV),
      parseCSV<Task>(tasksCSV),
    ])

    return { clients, workers, tasks }
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
}
