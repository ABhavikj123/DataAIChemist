"use client"

import { useState, useCallback } from "react"
import { useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Upload, FileText, AlertCircle, CheckCircle, Database } from "lucide-react"
import { parseFile, loadSampleData } from "@/lib/file-handler"
import { validateAll } from "@/lib/validation"
import { saveClients, saveWorkers, saveTasks, saveValidationErrors } from "@/lib/indexeddb"
import { setClients, setWorkers, setTasks, setValidationErrors, setLoading } from "@/store"
import type { Client, Worker, Task } from "@/types"

const EXPECTED_FIELDS = {
  clients: ["ClientID", "ClientName", "PriorityLevel", "RequestedTaskIDs", "GroupTag", "AttributesJSON"],
  workers: [
    "WorkerID",
    "WorkerName",
    "Skills",
    "AvailableSlots",
    "MaxLoadPerPhase",
    "WorkerGroup",
    "QualificationLevel",
  ],
  tasks: ["TaskID", "TaskName", "Category", "Duration", "RequiredSkills", "PreferredPhases", "MaxConcurrent"],
}

export default function DataUpload() {
  const dispatch = useDispatch()
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<{
    clients: boolean
    workers: boolean
    tasks: boolean
  }>({ clients: false, workers: false, tasks: false })

  const handleFileUpload = useCallback(
    async (files: FileList | null, entityType: "clients" | "workers" | "tasks") => {
      if (!files || files.length === 0) return

      const file = files[0]
      if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
        setStatusMessage("Please upload a CSV or XLSX file")
        setUploadStatus("error")
        return
      }

      setUploadStatus("uploading")
      setUploadProgress(0)
      setStatusMessage(`Processing ${entityType} file...`)
      dispatch(setLoading(true))

      try {
        setUploadProgress(25)

        const data = await parseFile(file, EXPECTED_FIELDS[entityType])
        setUploadProgress(60)

        if (entityType === "clients") {
          await saveClients(data as Client[])
          dispatch(setClients(data as Client[]))
        } else if (entityType === "workers") {
          await saveWorkers(data as Worker[])
          dispatch(setWorkers(data as Worker[]))
        } else if (entityType === "tasks") {
          await saveTasks(data as Task[])
          dispatch(setTasks(data as Task[]))
        }

        setUploadProgress(100)
        setUploadedFiles((prev) => ({ ...prev, [entityType]: true }))
        setUploadStatus("success")
        setStatusMessage(`${entityType} data uploaded successfully! AI-powered column mapping applied.`)
      } catch (error) {
        console.error("Upload failed:", error)
        setStatusMessage(error instanceof Error ? error.message : "Upload failed")
        setUploadStatus("error")
      } finally {
        dispatch(setLoading(false))
      }
    },
    [dispatch],
  )

  const loadSampleDataHandler = useCallback(async () => {
    setUploadStatus("uploading")
    setUploadProgress(0)
    setStatusMessage("Loading sample data...")
    dispatch(setLoading(true))

    try {
      const { clients, workers, tasks } = await loadSampleData()
      setUploadProgress(50)

      await Promise.all([saveClients(clients), saveWorkers(workers), saveTasks(tasks)])

      dispatch(setClients(clients))
      dispatch(setWorkers(workers))
      dispatch(setTasks(tasks))

      setUploadProgress(75)

      const errors = validateAll(clients, workers, tasks)
      await saveValidationErrors(errors)
      dispatch(setValidationErrors(errors))

      setUploadProgress(100)
      setUploadedFiles({ clients: true, workers: true, tasks: true })
      setUploadStatus("success")
      setStatusMessage("Sample data loaded successfully with validation complete!")
    } catch (error) {
      console.error("Failed to load sample data:", error)
      setStatusMessage("Failed to load sample data")
      setUploadStatus("error")
    } finally {
      dispatch(setLoading(false))
    }
  }, [dispatch])

  const FileUploadCard = ({
    entityType,
    title,
    description,
    fields,
  }: {
    entityType: "clients" | "workers" | "tasks"
    title: string
    description: string
    fields: string[]
  }) => (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <FileText className="mr-2 h-5 w-5" />
          {title}
          {uploadedFiles[entityType] && <CheckCircle className="ml-2 h-4 w-4 text-green-600" />}
        </CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-3" />
          <div>
            <label htmlFor={`${entityType}-upload`} className="cursor-pointer">
              <span className="text-sm font-medium text-gray-900 hover:text-blue-600">
                Drop files here or click to upload
              </span>
              <input
                id={`${entityType}-upload`}
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => handleFileUpload(e.target.files, entityType)}
              />
            </label>
          </div>
        </div>
        <div className="text-xs text-gray-500 space-y-1">
          <p className="font-medium">Expected columns:</p>
          <div className="grid grid-cols-1 gap-1">
            {fields.map((field) => (
              <span key={field} className="text-xs bg-gray-100 px-2 py-1 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="text-center md:text-left">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Data Upload</h2>
        <p className="text-gray-600 mt-2">Upload your CSV or XLSX files to get started with data processing</p>
      </div>

      {uploadStatus === "uploading" && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{statusMessage}</span>
                  <span className="text-sm text-gray-500">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadStatus === "success" && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      )}

      {uploadStatus === "error" && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <FileUploadCard
          entityType="clients"
          title="Clients Data"
          description="Upload client information with priority levels and task requests"
          fields={EXPECTED_FIELDS.clients}
        />

        <FileUploadCard
          entityType="workers"
          title="Workers Data"
          description="Upload worker information with skills and availability"
          fields={EXPECTED_FIELDS.workers}
        />

        <FileUploadCard
          entityType="tasks"
          title="Tasks Data"
          description="Upload task information with requirements and constraints"
          fields={EXPECTED_FIELDS.tasks}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2 h-5 w-5" />
            Quick Start
          </CardTitle>
          <CardDescription>
            Load sample data to explore all application features including validation, AI analysis, and rule creation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={loadSampleDataHandler} className="w-full sm:w-auto" disabled={uploadStatus === "uploading"}>
            <Database className="mr-2 h-4 w-4" />
            Load Sample Data
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
