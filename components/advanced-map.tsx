"use client"

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from './ui/button'
import {
  MapPin,
  Satellite,
  Map as MapIcon,
  Navigation,
  Copy,
  ExternalLink,
  Target,
  Mountain,
  Clock
} from 'lucide-react'

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
) as React.ComponentType<Record<string, unknown>>
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
) as React.ComponentType<Record<string, unknown>>
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
) as React.ComponentType<Record<string, unknown>>
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
) as React.ComponentType<Record<string, unknown>>

interface AdvancedMapProps {
  latitude: number
  longitude: number
  altitude?: number
  accuracy?: number
  timestamp?: string
  address?: string
  onClose: () => void
}

interface CoordinateFormat {
  decimal: string
  dms: string
  utm: string
}

export function AdvancedMap({ 
  latitude, 
  longitude, 
  altitude, 
  accuracy, 
  timestamp, 
  address,
  onClose 
}: AdvancedMapProps) {
  const [mapType, setMapType] = useState<'street' | 'satellite' | 'terrain'>('street')
  const [coordinateFormat, setCoordinateFormat] = useState<'decimal' | 'dms' | 'utm'>('decimal')
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Convert decimal degrees to DMS (Degrees, Minutes, Seconds)
  const toDMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal)
    const degrees = Math.floor(absolute)
    const minutes = Math.floor((absolute - degrees) * 60)
    const seconds = ((absolute - degrees) * 60 - minutes) * 60
    
    const direction = isLatitude 
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W')
    
    return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`
  }

  // Convert to UTM (simplified)
  const toUTM = (lat: number, lng: number): string => {
    const zone = Math.floor((lng + 180) / 6) + 1
    const hemisphere = lat >= 0 ? 'N' : 'S'
    return `Zone ${zone}${hemisphere} (approx)`
  }

  const coordinates: CoordinateFormat = {
    decimal: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    dms: `${toDMS(latitude, true)}, ${toDMS(longitude, false)}`,
    utm: toUTM(latitude, longitude)
  }

  const mapLayers = {
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
  }

  const copyCoordinates = () => {
    navigator.clipboard.writeText(coordinates[coordinateFormat])
  }

  const openInGoogleMaps = () => {
    window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank')
  }

  const openInGoogleEarth = () => {
    window.open(`https://earth.google.com/web/@${latitude},${longitude},1000a,1000d,35y,0h,0t,0r`, '_blank')
  }

  const openStreetView = () => {
    window.open(`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`, '_blank')
  }

  if (!isClient) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-gray-900 rounded-lg border border-purple-400/20 p-8">
          <div className="text-white">Loading map...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-purple-400/20 w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-purple-300" />
            <h3 className="text-lg font-semibold text-white">Advanced Location Analysis</h3>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            ✕
          </Button>
        </div>

        <div className="flex h-[calc(90vh-80px)]">
          {/* Map */}
          <div className="flex-1 relative">
            <MapContainer
              center={[latitude, longitude]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              className="z-10"
            >
              <TileLayer
                url={mapLayers[mapType]}
                attribution={
                  mapType === 'street' 
                    ? '© OpenStreetMap contributors'
                    : mapType === 'satellite'
                    ? '© Esri'
                    : '© OpenTopoMap'
                }
              />
              <Marker position={[latitude, longitude]}>
                <Popup>
                  <div className="text-sm">
                    <div className="font-medium">Photo Location</div>
                    <div>{coordinates.decimal}</div>
                    {altitude && <div>Altitude: {altitude}m</div>}
                    {timestamp && <div>Time: {timestamp}</div>}
                  </div>
                </Popup>
              </Marker>
            </MapContainer>

            {/* Map Controls */}
            <div className="absolute top-4 right-4 z-20 space-y-2">
              <div className="bg-black/80 rounded-lg p-2 space-y-1">
                <Button
                  onClick={() => setMapType('street')}
                  size="sm"
                  variant={mapType === 'street' ? 'default' : 'ghost'}
                  className="w-full justify-start"
                >
                  <MapIcon className="w-4 h-4 mr-2" />
                  Street
                </Button>
                <Button
                  onClick={() => setMapType('satellite')}
                  size="sm"
                  variant={mapType === 'satellite' ? 'default' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Satellite className="w-4 h-4 mr-2" />
                  Satellite
                </Button>
                <Button
                  onClick={() => setMapType('terrain')}
                  size="sm"
                  variant={mapType === 'terrain' ? 'default' : 'ghost'}
                  className="w-full justify-start"
                >
                  <Mountain className="w-4 h-4 mr-2" />
                  Terrain
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-80 bg-black/40 border-l border-gray-700/30 p-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Coordinates */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <Target className="w-4 h-4 mr-2" />
                  Coordinates
                </h4>
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {(['decimal', 'dms', 'utm'] as const).map((format) => (
                      <Button
                        key={format}
                        onClick={() => setCoordinateFormat(format)}
                        size="sm"
                        variant={coordinateFormat === format ? 'default' : 'ghost'}
                        className="text-xs"
                      >
                        {format.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  <div className="bg-black/60 rounded p-3">
                    <div className="text-white font-mono text-sm">
                      {coordinates[coordinateFormat]}
                    </div>
                    <Button
                      onClick={copyCoordinates}
                      size="sm"
                      className="mt-2 w-full"
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      Copy
                    </Button>
                  </div>
                </div>
              </div>

              {/* Location Details */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <Navigation className="w-4 h-4 mr-2" />
                  Details
                </h4>
                <div className="space-y-2 text-sm">
                  {altitude && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Altitude:</span>
                      <span className="text-white">{altitude}m</span>
                    </div>
                  )}
                  {accuracy && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Accuracy:</span>
                      <span className="text-white">±{accuracy}m</span>
                    </div>
                  )}
                  {timestamp && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Timestamp:</span>
                      <span className="text-white">{timestamp}</span>
                    </div>
                  )}
                  {address && (
                    <div>
                      <span className="text-gray-400">Address:</span>
                      <div className="text-white mt-1">{address}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* External Links */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  External Maps
                </h4>
                <div className="space-y-2">
                  <Button
                    onClick={openInGoogleMaps}
                    size="sm"
                    className="w-full justify-start"
                  >
                    <MapIcon className="w-4 h-4 mr-2" />
                    Google Maps
                  </Button>
                  <Button
                    onClick={openInGoogleEarth}
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Satellite className="w-4 h-4 mr-2" />
                    Google Earth
                  </Button>
                  <Button
                    onClick={openStreetView}
                    size="sm"
                    className="w-full justify-start"
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Street View
                  </Button>
                </div>
              </div>

              {/* Weather Info (placeholder) */}
              <div>
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Additional Info
                </h4>
                <div className="bg-black/60 rounded p-3 text-sm">
                  <div className="text-gray-400 mb-2">Timezone (approx):</div>
                  <div className="text-white">
                    UTC{longitude > 0 ? '+' : ''}{Math.round(longitude / 15)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}