"use client"

import { useState, useCallback, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { RotateCcw, Save, Settings } from "lucide-react"
import type { RootState } from "@/store"
import { setPriorityWeights } from "@/store"
import { savePriorityWeights, getPriorityWeights } from "@/lib/indexeddb"
import type { PriorityWeights } from "@/types"

const CRITERIA_ITEMS = [
  {
    id: "priorityLevel",
    label: "Priority Level",
    description: "Client priority importance",
    color: "bg-blue-500",
  },
  {
    id: "fairness",
    label: "Fairness",
    description: "Equal work distribution",
    color: "bg-green-500",
  },
  {
    id: "efficiency",
    label: "Efficiency",
    description: "Resource utilization",
    color: "bg-yellow-500",
  },
  {
    id: "skillMatch",
    label: "Skill Match",
    description: "Worker-task skill alignment",
    color: "bg-purple-500",
  },
  {
    id: "phasePreference",
    label: "Phase Preference",
    description: "Preferred timing alignment",
    color: "bg-red-500",
  },
]

export default function PrioritySettings() {
  const dispatch = useDispatch()
  const priorityWeights = useSelector((state: RootState) => state.app.priorityWeights)
  const [localWeights, setLocalWeights] = useState<PriorityWeights>(priorityWeights)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState("")

  useEffect(() => {
    const loadWeights = async () => {
      try {
        const savedWeights = await getPriorityWeights()
        if (savedWeights) {
          setLocalWeights(savedWeights)
          dispatch(setPriorityWeights(savedWeights))
        }
      } catch (error) {
        console.error("Failed to load priority weights:", error)
      }
    }
    loadWeights()
  }, [dispatch])

  const handleWeightChange = useCallback(
    (criterion: keyof PriorityWeights, value: number[]) => {
      const newWeight = value[0] / 100
      const newWeights = { ...localWeights, [criterion]: newWeight }

      const total = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0)
      if (total > 0) {
        Object.keys(newWeights).forEach((key) => {
          newWeights[key as keyof PriorityWeights] = newWeights[key as keyof PriorityWeights] / total
        })
      }

      setLocalWeights(newWeights)
    },
    [localWeights],
  )

  const saveWeights = useCallback(async () => {
    setIsSaving(true)
    setSaveMessage("")

    try {
      dispatch(setPriorityWeights(localWeights))
      await savePriorityWeights(localWeights)
      setSaveMessage("Priority weights saved successfully!")

      setTimeout(() => setSaveMessage(""), 3000)
    } catch (error) {
      console.error("Failed to save priority weights:", error)
      setSaveMessage("Failed to save priority weights")
    } finally {
      setIsSaving(false)
    }
  }, [dispatch, localWeights])

  const resetToDefault = useCallback(() => {
    const defaultWeights: PriorityWeights = {
      priorityLevel: 0.3,
      fairness: 0.2,
      efficiency: 0.2,
      skillMatch: 0.2,
      phasePreference: 0.1,
    }
    setLocalWeights(defaultWeights)
    setSaveMessage("")
  }, [])

  const getWeightPercentage = (weight: number) => Math.round(weight * 100)

  const WeightSliders = () => (
    <div className="space-y-6">
      {CRITERIA_ITEMS.map((item, index) => {
        const weight = localWeights[item.id as keyof PriorityWeights]
        const percentage = getWeightPercentage(weight)

        return (
          <div key={item.id} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="text-xs">
                  {index + 1}
                </Badge>
                <div>
                  <h4 className="font-medium text-gray-900">{item.label}</h4>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-gray-900">{percentage}%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Slider
                value={[percentage]}
                onValueChange={(value) => handleWeightChange(item.id as keyof PriorityWeights, value)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <Progress value={percentage} className="h-2" />
            </div>
          </div>
        )
      })}
    </div>
  )

  const WeightVisualization = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Priority Weight Distribution</h3>
        <p className="text-sm text-gray-600">Visual representation of current weight allocation</p>
      </div>

      <div className="space-y-4">
        {CRITERIA_ITEMS.map((item) => {
          const weight = localWeights[item.id as keyof PriorityWeights]
          const percentage = getWeightPercentage(weight)

          return (
            <div key={item.id} className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded ${item.color}`} />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-900">{item.label}</span>
                  <span className="text-sm text-gray-600">{percentage}%</span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Weight Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Weight:</span>
            <span className="ml-2 font-medium">100%</span>
          </div>
          <div>
            <span className="text-gray-600">Highest Priority:</span>
            <span className="ml-2 font-medium">
              {
                CRITERIA_ITEMS.find(
                  (item) => localWeights[item.id as keyof PriorityWeights] === Math.max(...Object.values(localWeights)),
                )?.label
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Priority Settings</h2>
          <p className="text-gray-600 mt-2">Configure priority weights for task assignment and resource allocation</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={resetToDefault} variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Default
          </Button>
          <Button onClick={saveWeights} disabled={isSaving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Weights"}
          </Button>
        </div>
      </div>

      {saveMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            saveMessage.includes("success")
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {saveMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Priority Weight Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sliders" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sliders">Weight Sliders</TabsTrigger>
              <TabsTrigger value="visualization">Visualization</TabsTrigger>
            </TabsList>

            <TabsContent value="sliders" className="mt-6">
              <WeightSliders />
            </TabsContent>

            <TabsContent value="visualization" className="mt-6">
              <WeightVisualization />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Priority Criteria Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CRITERIA_ITEMS.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg">
                <div className="flex items-center space-x-3 mb-2">
                  <div className={`w-3 h-3 rounded ${item.color}`} />
                  <h4 className="font-medium text-gray-900">{item.label}</h4>
                </div>
                <p className="text-sm text-gray-600">{item.description}</p>
                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    Current weight: {getWeightPercentage(localWeights[item.id as keyof PriorityWeights])}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
