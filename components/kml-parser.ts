import { DOMParser } from "xmldom"
import * as turf from "@turf/turf"

class KmlParser {
  private xmlDoc: Document
  private geoJson: any = {
    type: "FeatureCollection",
    features: [],
    summary: {},
  }

  constructor(kmlString: string) {
    const parser = new DOMParser()
    this.xmlDoc = parser.parseFromString(kmlString, "text/xml")
  }

  parse() {
    // Parse placemarks
    const placemarks = this.xmlDoc.getElementsByTagName("Placemark")
    for (let i = 0; i < placemarks.length; i++) {
      this.parsePlacemark(placemarks[i])
    }

    // Generate summary
    this.generateSummary()

    return this.geoJson
  }

  private parsePlacemark(placemark: Element) {
    const name = this.getElementValue(placemark, "name")
    const description = this.getElementValue(placemark, "description")

    // Check for Point
    const point = placemark.getElementsByTagName("Point")[0]
    if (point) {
      const coordinates = this.parseCoordinates(point.getElementsByTagName("coordinates")[0])
      if (coordinates.length > 0) {
        this.addFeature(
          "Point",
          {
            type: "Point",
            coordinates: [coordinates[0][0], coordinates[0][1]],
          },
          { name, description },
        )
      }
      return
    }

    // Check for LineString
    const lineString = placemark.getElementsByTagName("LineString")[0]
    if (lineString) {
      const coordinates = this.parseCoordinates(lineString.getElementsByTagName("coordinates")[0])
      if (coordinates.length > 0) {
        const lineCoords = coordinates.map((coord) => [coord[0], coord[1]])
        const feature = this.addFeature(
          "LineString",
          {
            type: "LineString",
            coordinates: lineCoords,
          },
          { name, description },
        )

        // Calculate length
        const length = this.calculateLength(feature)
        feature.properties.length = length
      }
      return
    }

    // Check for Polygon
    const polygon = placemark.getElementsByTagName("Polygon")[0]
    if (polygon) {
      const outerBoundary = polygon.getElementsByTagName("outerBoundaryIs")[0]
      if (outerBoundary) {
        const linearRing = outerBoundary.getElementsByTagName("LinearRing")[0]
        if (linearRing) {
          const coordinates = this.parseCoordinates(linearRing.getElementsByTagName("coordinates")[0])
          if (coordinates.length > 0) {
            const polygonCoords = coordinates.map((coord) => [coord[0], coord[1]])
            // Close the polygon if not already closed
            if (
              polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] ||
              polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1]
            ) {
              polygonCoords.push(polygonCoords[0])
            }
            this.addFeature(
              "Polygon",
              {
                type: "Polygon",
                coordinates: [polygonCoords],
              },
              { name, description },
            )
          }
        }
      }
      return
    }

    // Check for MultiGeometry
    const multiGeometry = placemark.getElementsByTagName("MultiGeometry")[0]
    if (multiGeometry) {
      // Handle LineStrings in MultiGeometry
      const lineStrings = multiGeometry.getElementsByTagName("LineString")
      if (lineStrings.length > 0) {
        const multiLineCoords = []
        for (let i = 0; i < lineStrings.length; i++) {
          const coordinates = this.parseCoordinates(lineStrings[i].getElementsByTagName("coordinates")[0])
          if (coordinates.length > 0) {
            multiLineCoords.push(coordinates.map((coord) => [coord[0], coord[1]]))
          }
        }
        if (multiLineCoords.length > 0) {
          const feature = this.addFeature(
            "MultiLineString",
            {
              type: "MultiLineString",
              coordinates: multiLineCoords,
            },
            { name, description },
          )

          // Calculate total length of all line segments
          const length = this.calculateLength(feature)
          feature.properties.length = length
        }
      }

      // Handle Points in MultiGeometry
      const points = multiGeometry.getElementsByTagName("Point")
      if (points.length > 0) {
        const multiPointCoords = []
        for (let i = 0; i < points.length; i++) {
          const coordinates = this.parseCoordinates(points[i].getElementsByTagName("coordinates")[0])
          if (coordinates.length > 0) {
            multiPointCoords.push([coordinates[0][0], coordinates[0][1]])
          }
        }
        if (multiPointCoords.length > 0) {
          this.addFeature(
            "MultiPoint",
            {
              type: "MultiPoint",
              coordinates: multiPointCoords,
            },
            { name, description },
          )
        }
      }

      // Handle Polygons in MultiGeometry
      const polygons = multiGeometry.getElementsByTagName("Polygon")
      if (polygons.length > 0) {
        const multiPolygonCoords = []
        for (let i = 0; i < polygons.length; i++) {
          const outerBoundary = polygons[i].getElementsByTagName("outerBoundaryIs")[0]
          if (outerBoundary) {
            const linearRing = outerBoundary.getElementsByTagName("LinearRing")[0]
            if (linearRing) {
              const coordinates = this.parseCoordinates(linearRing.getElementsByTagName("coordinates")[0])
              if (coordinates.length > 0) {
                const polygonCoords = coordinates.map((coord) => [coord[0], coord[1]])
                // Close the polygon if not already closed
                if (
                  polygonCoords[0][0] !== polygonCoords[polygonCoords.length - 1][0] ||
                  polygonCoords[0][1] !== polygonCoords[polygonCoords.length - 1][1]
                ) {
                  polygonCoords.push(polygonCoords[0])
                }
                multiPolygonCoords.push([polygonCoords])
              }
            }
          }
        }
        if (multiPolygonCoords.length > 0) {
          this.addFeature(
            "MultiPolygon",
            {
              type: "MultiPolygon",
              coordinates: multiPolygonCoords,
            },
            { name, description },
          )
        }
      }
    }
  }

  private parseCoordinates(coordinatesElement: Element): [number, number, number?][] {
    if (!coordinatesElement) return []

    const coordinatesText = coordinatesElement.textContent || ""
    const coordinates: [number, number, number?][] = []

    // Split by whitespace and filter out empty strings
    const coordStrings = coordinatesText.split(/\s+/).filter(Boolean)

    for (const coordString of coordStrings) {
      // Split by comma
      const parts = coordString.split(",")
      if (parts.length >= 2) {
        const lon = Number.parseFloat(parts[0])
        const lat = Number.parseFloat(parts[1])
        const alt = parts.length > 2 ? Number.parseFloat(parts[2]) : undefined

        if (!isNaN(lon) && !isNaN(lat)) {
          coordinates.push([lon, lat, alt])
        }
      }
    }

    return coordinates
  }

  private getElementValue(parent: Element, tagName: string): string {
    const elements = parent.getElementsByTagName(tagName)
    if (elements.length > 0) {
      return elements[0].textContent || ""
    }
    return ""
  }

  private addFeature(type: string, geometry: any, properties: any) {
    const feature = {
      type: "Feature",
      geometry,
      properties,
    }
    this.geoJson.features.push(feature)
    return feature
  }

  private calculateLength(feature: any): number {
    try {
      if (feature.geometry.type === "LineString") {
        return turf.length(feature, { units: "meters" })
      } else if (feature.geometry.type === "MultiLineString") {
        let totalLength = 0
        for (const line of feature.geometry.coordinates) {
          const lineFeature = {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: line,
            },
          }
          totalLength += turf.length(lineFeature, { units: "meters" })
        }
        return totalLength
      }
    } catch (error) {
      console.error("Error calculating length:", error)
    }
    return 0
  }

  private generateSummary() {
    const summary: Record<string, number> = {}

    // Count Placemarks
    const placemarks = this.xmlDoc.getElementsByTagName("Placemark")
    summary["Placemark"] = placemarks.length

    // Count other element types
    for (const feature of this.geoJson.features) {
      const type = feature.geometry.type
      summary[type] = (summary[type] || 0) + 1
    }

    this.geoJson.summary = summary
  }
}

export default KmlParser

