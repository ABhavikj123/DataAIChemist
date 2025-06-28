"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useSelector } from "react-redux"
import type { RootState } from "@/store"
import {
  Upload,
  CheckCircle,
  Settings,
  Sliders,
  Download,
  Database,
  Search,
  AlertTriangle,
  Menu,
  X,
} from "lucide-react"

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const validationErrors = useSelector((state: RootState) => state.app.validationErrors)
  const errorCount = validationErrors.filter((error) => error.type === "error").length
  const warningCount = validationErrors.filter((error) => error.type === "warning").length

  const sections = [
    { id: "upload", label: "Data Upload", icon: Upload },
    { id: "data", label: "Data Grid", icon: Database },
    { id: "search", label: "Natural Search", icon: Search },
    { id: "validate", label: "Validation", icon: CheckCircle, badge: errorCount + warningCount },
    { id: "rules", label: "Business Rules", icon: Settings },
    { id: "priority", label: "Prioritization", icon: Sliders },
    { id: "export", label: "Export", icon: Download },
  ]

  const SidebarContent = () => (
    <div className="h-full bg-white border-r border-gray-200 p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Data Alchemist</h1>
        <p className="text-sm text-gray-600 mt-1">Spreadsheet Chaos Solver</p>
      </div>

      <nav className="space-y-2">
        {sections.map((section) => {
          const Icon = section.icon
          const isActive = activeSection === section.id

          return (
            <Button
              key={section.id}
              variant={isActive ? "default" : "ghost"}
              className={`w-full justify-start ${isActive ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-100"}`}
              onClick={() => {
                onSectionChange(section.id)
                setIsOpen(false)
              }}
            >
              <Icon className="mr-3 h-4 w-4" />
              {section.label}
              {section.badge && section.badge > 0 && (
                <Badge
                  variant={section.id === "validate" && errorCount > 0 ? "destructive" : "secondary"}
                  className="ml-auto"
                >
                  {section.badge}
                </Badge>
              )}
            </Button>
          )
        })}
      </nav>

      {validationErrors.length > 0 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="flex items-center mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
              <span className="text-sm font-medium">Validation Status</span>
            </div>
            <div className="space-y-1 text-sm">
              {errorCount > 0 && <div className="text-red-600">{errorCount} errors</div>}
              {warningCount > 0 && <div className="text-yellow-600">{warningCount} warnings</div>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="md:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      <div className="hidden md:block w-64 h-screen">
        <SidebarContent />
      </div>

      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsOpen(false)} />
          <div className="fixed left-0 top-0 w-64 h-full">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  )
}
