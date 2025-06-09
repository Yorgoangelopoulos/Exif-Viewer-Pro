"use client"

import React, { useState } from 'react'
import { Button } from './ui/button'
import {
  MapPin,
  Satellite,
  Map as MapIcon,
  Navigation,
  Copy,
  ExternalLink,
  Target,
  Mountain
} from 'lucide-react'

interface SimpleMapProps {
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

export function SimpleMap({ 
  latitude, 
  longitude, 
  altitude, 
  accuracy, 
  timestamp, 
  address,
  onClose 
}: SimpleMapProps) {
  const [coordinateFormat, setCoordinateFormat] = useState<'decimal' | 'dms' | 'utm'>('decimal')

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

  const openInOpenStreetMap = () => {
    window.open(`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=15`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg border border-purple-400/20 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-purple-300" />
            <h3 className="text-lg font-semibold text-white">Location Analysis</h3>
          </div>
          <Button onClick={onClose} variant="ghost" size="sm">
            ✕
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Embedded Google Maps */}
          <div className="aspect-video rounded-lg overflow-hidden border border-gray-700/30">
            <iframe
              src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dOWTgHz-TK7VFC&q=${latitude},${longitude}&zoom=15`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="bg-gray-800"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    Copy Coordinates
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
                <div className="flex justify-between">
                  <span className="text-gray-400">Timezone (approx):</span>
                  <span className="text-white">
                    UTC{longitude > 0 ? '+' : ''}{Math.round(longitude / 15)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* External Links */}
          <div>
            <h4 className="text-white font-medium mb-3 flex items-center">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in External Maps
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
              <Button
                onClick={openInOpenStreetMap}
                size="sm"
                className="w-full justify-start"
              >
                <Mountain className="w-4 h-4 mr-2" />
                OpenStreetMap
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}