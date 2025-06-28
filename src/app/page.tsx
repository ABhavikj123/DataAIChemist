"use client"

import { useState, useEffect } from "react"
import Sidebar from "@/components/Sidebar"
import DataUpload from "@/components/DataUpload"
import DataGrid from "@/components/DataGrid"
import NaturalSearch from "@/components/NaturalSearch"
import ValidationSummary from "@/components/ValidationSummary"
import RulesEditor from "@/components/RulesEditor"
import PrioritySettings from "@/components/PrioritySettings"
import ExportSection from "@/components/ExportSection"

export default function Page() {
  const [activeSection, setActiveSection] = useState("upload")
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const renderSection = () => {
    switch (activeSection) {
      case "upload":
        return <DataUpload />
      case "data":
        return <DataGrid />
      case "search":
        return <NaturalSearch />
      case "validate":
        return <ValidationSummary />
      case "rules":
        return <RulesEditor />
      case "priority":
        return <PrioritySettings />
      case "export":
        return <ExportSection />
      default:
        return <DataUpload />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className={`flex-1 overflow-y-auto ${isMobile ? "pt-16" : ""}`}>
        <div className="min-h-full">{renderSection()}</div>
      </main>
    </div>
  )
}
