"use client"

import { useEffect, useRef } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

interface MapComponentProps {
  kmlData: any
}

export default function MapComponent({ kmlData }: MapComponentProps) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  // Fix Leaflet default icon issue
  useEffect(() => {
    delete (L.Icon.Default.prototype as any)._getIconUrl

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    })
  }, [])

  useEffect(() => {
    if (!mapContainerRef.current) return

    // Initialize map if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([0, 0], 2)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current)
    }

    // Clear existing layers
    mapRef.current.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        mapRef.current?.removeLayer(layer)
      }
    })

    // Add GeoJSON data to map
    if (kmlData && kmlData.features && kmlData.features.length > 0) {
      const geoJsonLayer = L.geoJSON(kmlData, {
        style: (feature) => {
          return {
            color: feature?.properties?.color || "#3388ff",
            weight: 3,
            opacity: 0.7,
          }
        },
        pointToLayer: (feature, latlng) => {
          return L.marker(latlng)
        },
        onEachFeature: (feature, layer) => {
          if (feature.properties && feature.properties.name) {
            layer.bindPopup(`
              <strong>${feature.properties.name}</strong>
              ${feature.properties.description ? `<p>${feature.properties.description}</p>` : ""}
              ${feature.properties.length ? `<p>Length: ${feature.properties.length.toFixed(2)} meters</p>` : ""}
            `)
          }
        },
      }).addTo(mapRef.current)

      // Fit map to GeoJSON bounds
      const bounds = geoJsonLayer.getBounds()
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds)
      }
    }

    // Cleanup function
    return () => {
      // We don't destroy the map here to prevent re-initialization
      // when the component re-renders
    }
  }, [kmlData])

  // Handle map resize when window size changes
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize()
      }
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
    }
  }, [])

  return <div ref={mapContainerRef} className="h-full w-full" />
}

