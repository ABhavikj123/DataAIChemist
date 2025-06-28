"use client"

import { useState } from "react"
import { useSelector } from "react-redux"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Download, FileText, CheckCircle, AlertCircle } from "lucide-react"
import { exportToCSV } from "@/lib/file-handler"
import type { RootState } from "@/store"

export default function ExportSection() {
  const { clients, workers, tasks, rules, priorityWeights } = useSelector((state: RootState) => state.app)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<"idle" | "exporting" | "success" | "error">("idle")
  const [exportMessage, setExportMessage] = useState("")

  const handleExportAll = async () => {
    if (clients.length === 0 && workers.length === 0 && tasks.length === 0) {
      setExportMessage("No data to export. Please upload or load sample data first.")
      setExportStatus("error")
      return
    }

    setExportStatus("exporting")
    setExportProgress(0)
    setExportMessage("Preparing export files...")

    try {
      if (clients.length > 0) {
        exportToCSV(clients, "cleaned-clients.csv")
        setExportProgress(25)
      }

      if (workers.length > 0) {
        exportToCSV(workers, "cleaned-workers.csv")
        setExportProgress(50)
      }

      if (tasks.length > 0) {
        exportToCSV(tasks, "cleaned-tasks.csv")
        setExportProgress(75)
      }

      const rulesConfig = {
        rules: rules.filter((rule) => rule.active),
        priorityWeights,
        metadata: {
          exportDate: new Date().toISOString(),
          totalRules: rules.length,
          activeRules: rules.filter((rule) => rule.active).length,
          datasetInfo: {
            clients: clients.length,
            workers: workers.length,
            tasks: tasks.length,
          },
        },
      }

      const blob = new Blob([JSON.stringify(rulesConfig, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "rules-config.json"
      link.click()
      URL.revokeObjectURL(url)

      setExportProgress(100)
      setExportStatus("success")
      setExportMessage("All files exported successfully!")
    } catch (error) {
      console.error("Export failed:", error)
      setExportMessage("Export failed. Please try again.")
      setExportStatus("error")
    }
  }

  const exportIndividual = (type: "clients" | "workers" | "tasks") => {
    try {
      switch (type) {
        case "clients":
          if (clients.length === 0) throw new Error("No clients data to export")
          exportToCSV(clients, "cleaned-clients.csv")
          break
        case "workers":
          if (workers.length === 0) throw new Error("No workers data to export")
          exportToCSV(workers, "cleaned-workers.csv")
          break
        case "tasks":
          if (tasks.length === 0) throw new Error("No tasks data to export")
          exportToCSV(tasks, "cleaned-tasks.csv")
          break
      }
      setExportMessage(`${type} data exported successfully!`)
      setExportStatus("success")
    } catch (error) {
      setExportMessage(error instanceof Error ? error.message : "Export failed")
      setExportStatus("error")
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Export Data</h2>
        <p className="text-gray-600 mt-2">Download your cleaned and validated data files</p>
      </div>

      {exportStatus === "exporting" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{exportMessage}</span>
                  <span className="text-sm text-gray-500">{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {exportStatus === "success" && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{exportMessage}</AlertDescription>
        </Alert>
      )}

      {exportStatus === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{exportMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileText className="mr-2 h-5 w-5" />
              Clients
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <strong>{clients.length}</strong> records
                </p>
                <p>Validated and cleaned client data</p>
              </div>
              <Button
                onClick={() => exportIndividual("clients")}
                className="w-full"
                disabled={clients.length === 0}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileText className="mr-2 h-5 w-5" />
              Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <strong>{workers.length}</strong> records
                </p>
                <p>Validated and cleaned worker data</p>
              </div>
              <Button
                onClick={() => exportIndividual("workers")}
                className="w-full"
                disabled={workers.length === 0}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileText className="mr-2 h-5 w-5" />
              Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <strong>{tasks.length}</strong> records
                </p>
                <p>Validated and cleaned task data</p>
              </div>
              <Button
                onClick={() => exportIndividual("tasks")}
                className="w-full"
                disabled={tasks.length === 0}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileText className="mr-2 h-5 w-5" />
              Rules Config
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p>
                  <strong>{rules.filter((r) => r.active).length}</strong> active rules
                </p>
                <p>Business rules and priorities</p>
              </div>
              <Button
                onClick={() => {
                  const config = { rules: rules.filter((r) => r.active), priorityWeights }
                  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement("a")
                  link.href = url
                  link.download = "rules-config.json"
                  link.click()
                  URL.revokeObjectURL(url)
                }}
                className="w-full"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export All Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-gray-600">
              Download all cleaned CSV files and rules configuration in one go. This will export clients.csv,
              workers.csv, tasks.csv, and rules-config.json.
            </p>
            <Button onClick={handleExportAll} className="w-full md:w-auto" disabled={exportStatus === "exporting"}>
              <Download className="mr-2 h-4 w-4" />
              Export All Files
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
