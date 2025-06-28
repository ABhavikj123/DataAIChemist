"use client"

import { useState, useCallback, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Wand2, AlertCircle, CheckCircle } from "lucide-react"
import type { RootState } from "@/store"
import { setSearchQuery, updateClient, updateWorker, updateTask, setValidationErrors } from "@/store"
import { interpretNaturalLanguageQuery, interpretNaturalLanguageModification } from "@/lib/gemini"
import { validateAll } from "@/lib/validation"
import { saveClients, saveWorkers, saveTasks, saveValidationErrors } from "@/lib/indexeddb"
import { useDebounce } from "@/hooks/useDebounce"
import type { Client, Worker, Task } from "@/types"

function createFilterFunction(filterExpression: string) {
  try {
    if (!filterExpression || filterExpression === "true") {
      return () => true
    }

    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /document\./,
      /window\./,
      /global\./,
      /process\./,
    ]

    if (dangerousPatterns.some((pattern) => pattern.test(filterExpression))) {
      console.warn("Potentially dangerous expression detected, using safe fallback")
      return () => true
    }

    return new Function(
      "item",
      `
      try {
        return ${filterExpression};
      } catch (e) {
        console.warn("Filter expression error:", e);
        return true;
      }
    `,
    )
  } catch (error) {
    console.warn("Failed to create filter function:", error)
    return () => true
  }
}

export default function NaturalSearch() {
  const dispatch = useDispatch()
  const { clients, workers, tasks, searchQuery } = useSelector((state: RootState) => state.app)
  const [modificationCommand, setModificationCommand] = useState("")
  const [filteredData, setFilteredData] = useState<{ clients: Client[]; workers: Worker[]; tasks: Task[] }>({
    clients: [],
    workers: [],
    tasks: [],
  })
  const [isSearching, setIsSearching] = useState(false)
  const [isModifying, setIsModifying] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [modificationError, setModificationError] = useState("")
  const [modificationSuccess, setModificationSuccess] = useState("")
  const [activeTab, setActiveTab] = useState("clients")

  const debouncedSearchQuery = useDebounce(searchQuery, 500)

  useEffect(() => {
    setFilteredData({ clients, workers, tasks })
  }, [clients, workers, tasks])

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setFilteredData({ clients, workers, tasks })
        setSearchError("")
        return
      }

      setIsSearching(true)
      setSearchError("")

      try {
        const [clientsFilter, workersFilter, tasksFilter] = await Promise.all([
          interpretNaturalLanguageQuery(query, "clients"),
          interpretNaturalLanguageQuery(query, "workers"),
          interpretNaturalLanguageQuery(query, "tasks"),
        ])

        const clientsFilterFn = createFilterFunction(clientsFilter)
        const workersFilterFn = createFilterFunction(workersFilter)
        const tasksFilterFn = createFilterFunction(tasksFilter)

        const filteredClients = clients.filter((item) => {
          try {
            return (clientsFilterFn as (item: Client) => boolean)(item)
          } catch (error) {
            console.warn("Client filter error:", error)
            return true
          }
        })

        const filteredWorkers = workers.filter((item) => {
          try {
            return (workersFilterFn as (item: Worker) => boolean)(item)
          } catch (error) {
            console.warn("Worker filter error:", error)
            return true
          }
        })

        const filteredTasks = tasks.filter((item) => {
          try {
            return (tasksFilterFn as (item: Task) => boolean)(item)
          } catch (error) {
            console.warn("Task filter error:", error)
            return true
          }
        })

        setFilteredData({
          clients: filteredClients,
          workers: filteredWorkers,
          tasks: filteredTasks,
        })
      } catch (error) {
        console.error("Search failed:", error)
        setSearchError("Failed to interpret search query. Please try rephrasing or check your internet connection.")
        setFilteredData({ clients, workers, tasks })
      } finally {
        setIsSearching(false)
      }
    },
    [clients, workers, tasks],
  )

  useEffect(() => {
    handleSearch(debouncedSearchQuery)
  }, [debouncedSearchQuery, handleSearch])

  const handleModification = useCallback(async () => {
    if (!modificationCommand.trim()) return

    setIsModifying(true)
    setModificationError("")
    setModificationSuccess("")

    try {
      const [clientsModification, workersModification, tasksModification] = await Promise.all([
        interpretNaturalLanguageModification(modificationCommand, "clients"),
        interpretNaturalLanguageModification(modificationCommand, "workers"),
        interpretNaturalLanguageModification(modificationCommand, "tasks"),
      ])

      let updatedClients = [...clients]
      let updatedWorkers = [...workers]
      let updatedTasks = [...tasks]
      let modificationsApplied = 0

      if (clientsModification.field && clientsModification.field !== "") {
        try {
          const filterFn = clientsModification.condition
            ? createFilterFunction(clientsModification.condition)
            : () => true

          updatedClients = updatedClients.map((client, index) => {
            try {
              if (filterFn(client)) {
                const updatedClient = { ...client, [clientsModification.field]: clientsModification.value }
                dispatch(updateClient({ index, client: updatedClient }))
                modificationsApplied++
                return updatedClient
              }
            } catch (error) {
              console.warn("Client modification error:", error)
            }
            return client
          })
        } catch (error) {
          console.warn("Client modification failed:", error)
        }
      }

      if (workersModification.field && workersModification.field !== "") {
        try {
          const filterFn = workersModification.condition
            ? createFilterFunction(workersModification.condition)
            : () => true

          updatedWorkers = updatedWorkers.map((worker, index) => {
            try {
              if (filterFn(worker)) {
                const updatedWorker = { ...worker, [workersModification.field]: workersModification.value }
                dispatch(updateWorker({ index, worker: updatedWorker }))
                modificationsApplied++
                return updatedWorker
              }
            } catch (error) {
              console.warn("Worker modification error:", error)
            }
            return worker
          })
        } catch (error) {
          console.warn("Worker modification failed:", error)
        }
      }

      if (tasksModification.field && tasksModification.field !== "") {
        try {
          const filterFn = tasksModification.condition ? createFilterFunction(tasksModification.condition) : () => true

          updatedTasks = updatedTasks.map((task, index) => {
            try {
              if (filterFn(task)) {
                const updatedTask = { ...task, [tasksModification.field]: tasksModification.value }
                dispatch(updateTask({ index, task: updatedTask }))
                modificationsApplied++
                return updatedTask
              }
            } catch (error) {
              console.warn("Task modification error:", error)
            }
            return task
          })
        } catch (error) {
          console.warn("Task modification failed:", error)
        }
      }
      await Promise.all([saveClients(updatedClients), saveWorkers(updatedWorkers), saveTasks(updatedTasks)])

      const errors = validateAll(updatedClients, updatedWorkers, updatedTasks)
      await saveValidationErrors(errors)
      dispatch(setValidationErrors(errors))

      if (modificationsApplied > 0) {
        setModificationSuccess(`Successfully modified ${modificationsApplied} records!`)
        setModificationCommand("")

        setTimeout(() => setModificationSuccess(""), 3000)
      } else {
        setModificationError("No records were modified. Please check your command and try again.")
      }
    } catch (error) {
      console.error("Modification failed:", error)
      setModificationError(
        "Failed to interpret modification command. Please try rephrasing or check your internet connection.",
      )
    } finally {
      setIsModifying(false)
    }
  }, [modificationCommand, clients, workers, tasks, dispatch])

  const renderTable = (data: Record<string, unknown>[]) => {
    if (data.length === 0) {
      return (
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">No results found for your search query</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your search terms or criteria</p>
        </div>
      )
    }

    const headers = Object.keys(data[0] || {})

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Sr No</TableHead>
              {headers.map((header) => (
                <TableHead key={header} className="min-w-[120px]">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="text-gray-500 font-mono text-sm">{index + 1}</TableCell>
                {headers.map((header) => (
                  <TableCell key={header} className="max-w-[200px] truncate">
                    {String((item as Record<string, unknown>)[header] || "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Natural Language Search</h2>
        <p className="text-gray-600 mt-2">Search and modify your data using plain English</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="mr-2 h-5 w-5" />
            Search Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="e.g., 'tasks with duration greater than 2' or 'workers in TeamA'"
              value={searchQuery}
              onChange={(e) => dispatch(setSearchQuery(e.target.value))}
              className="flex-1"
            />
            <Button onClick={() => handleSearch(searchQuery)} disabled={isSearching}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
          </div>

          {searchError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{searchError}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">Example queries:</p>
            <ul className="space-y-1">
              <li>• &quot;Tasks with Duration greater than 2&quot;</li>
              <li>• &quot;Workers in TeamA with coding skills&quot;</li>
              <li>• &quot;Clients with PriorityLevel 5&quot;</li>
              <li>• &quot;Tasks requiring design and ux skills&quot;</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wand2 className="mr-2 h-5 w-5" />
            Modify Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="e.g., 'Set all PriorityLevels to 3 for GroupA clients'"
              value={modificationCommand}
              onChange={(e) => setModificationCommand(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleModification} disabled={isModifying || !modificationCommand.trim()}>
              {isModifying ? "Applying..." : "Apply"}
            </Button>
          </div>

          {modificationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{modificationError}</AlertDescription>
            </Alert>
          )}

          {modificationSuccess && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{modificationSuccess}</AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600">
            <p className="font-medium mb-2">Example modifications:</p>
            <ul className="space-y-1">
              <li>• &quot;Set PriorityLevel to 4 for all GroupB clients&quot;</li>
              <li>• &quot;Change MaxLoadPerPhase to 3 for TeamA workers&quot;</li>
              <li>• &quot;Update Duration to 2 for all Design category tasks&quot;</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Search Results</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="clients">Clients ({filteredData.clients.length})</TabsTrigger>
              <TabsTrigger value="workers">Workers ({filteredData.workers.length})</TabsTrigger>
              <TabsTrigger value="tasks">Tasks ({filteredData.tasks.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="clients" className="mt-6">
              {renderTable(filteredData.clients)}
            </TabsContent>

            <TabsContent value="workers" className="mt-6">
              {renderTable(filteredData.workers)}
            </TabsContent>

            <TabsContent value="tasks" className="mt-6">
              {renderTable(filteredData.tasks)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
