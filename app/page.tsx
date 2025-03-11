"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Map, FileText, AlertCircle } from "lucide-react"
import dynamic from "next/dynamic"
import KmlParser from "@/components/kml-parser"

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full bg-muted flex items-center justify-center">Loading map...</div>,
})

export default function Home() {
  const [kmlData, setKmlData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("map")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError(null)

    if (!file) return

    if (!file.name.endsWith(".kml")) {
      setError("Please upload a valid KML file")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const kmlString = e.target?.result as string
        const parser = new KmlParser(kmlString)
        setKmlData(parser.parse())
        setActiveTab("map") // Switch to map view after successful upload
      } catch (err) {
        setError("Failed to parse KML file. Please ensure it's a valid KML format.")
        console.error(err)
      }
    }
    reader.readAsText(file)
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <main className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">KML File Viewer</h1>

      <div className="flex flex-col items-center mb-8">
        <Button onClick={triggerFileInput} className="mb-4">
          <Upload className="mr-2 h-4 w-4" /> Upload KML File
        </Button>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".kml" className="hidden" />
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {kmlData && (
        <Card className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex justify-between items-center mb-6">
              <TabsList>
                <TabsTrigger value="map">
                  <Map className="mr-2 h-4 w-4" /> Map View
                </TabsTrigger>
                <TabsTrigger value="summary">
                  <FileText className="mr-2 h-4 w-4" /> Summary
                </TabsTrigger>
                <TabsTrigger value="detailed">
                  <FileText className="mr-2 h-4 w-4" /> Detailed
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="map" className="mt-0">
              <div className="h-[500px] w-full rounded-md overflow-hidden">
                <MapComponent kmlData={kmlData} />
              </div>
            </TabsContent>

            <TabsContent value="summary" className="mt-0">
              <h2 className="text-xl font-semibold mb-4">KML Element Summary</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Element Type</TableHead>
                    <TableHead>Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(kmlData.summary).map(([type, count]) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{type}</TableCell>
                      <TableCell>{count as number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="detailed" className="mt-0">
              <h2 className="text-xl font-semibold mb-4">Detailed Element Information</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Element Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Length (meters)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kmlData.features.map((feature: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{feature.geometry.type}</TableCell>
                      <TableCell>{feature.properties.name || "Unnamed"}</TableCell>
                      <TableCell>
                        {feature.properties.length ? `${feature.properties.length.toFixed(2)} m` : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </main>
  )
}

