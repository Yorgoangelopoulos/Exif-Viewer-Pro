"use client"

import React, { useState, useMemo } from 'react'
import { Button } from './ui/button'
import {
  MapPin,
  Calendar,
  Camera,
  Info,
  Download,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Search
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExifDataProps {
  file: File
  exifData: { [key: string]: unknown }
  imageUrl: string
}

interface ExifSection {
  title: string
  icon: React.ReactNode
  data: { [key: string]: unknown }
  color: string
}

export function ExifData({ file, exifData, imageUrl }: ExifDataProps): React.ReactElement {
  const [activeSection, setActiveSection] = useState<string>('basicinfo')
  const [showRawData, setShowRawData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const sections = useMemo((): ExifSection[] => {
    const basicInfo = {
      'File Name': file.name,
      'File Size': `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      'File Type': file.type,
      'Last Modified': new Date(file.lastModified).toLocaleString(),
      'Image Width': exifData.ExifImageWidth || exifData.ImageWidth || 'Not available',
      'Image Height': exifData.ExifImageHeight || exifData.ImageHeight || 'Not available',
      'Color Space': exifData.ColorSpace || 'sRGB',
      'Orientation': exifData.Orientation || 'Normal'
    }

    const cameraInfo = {
      'Camera Make': exifData.Make || 'Unknown',
      'Camera Model': exifData.Model || 'Unknown',
      'Lens Model': exifData.LensModel || 'Unknown',
      'Focal Length': exifData.FocalLength ? `${exifData.FocalLength}mm` : 'Not available',
      'Aperture': exifData.FNumber ? `f/${exifData.FNumber}` : 'Not available',
      'Shutter Speed': exifData.ExposureTime ? `1/${Math.round(1/(exifData.ExposureTime as number))}s` : 'Not available',
      'ISO': exifData.ISO || 'Not available',
      'Flash': exifData.Flash || 'Not available',
      'White Balance': exifData.WhiteBalance || 'Auto',
      'Exposure Mode': exifData.ExposureMode || 'Auto',
      'Metering Mode': exifData.MeteringMode || 'Pattern'
    }

    const locationInfo = {
      'GPS Latitude': exifData.latitude || 'Not available',
      'GPS Longitude': exifData.longitude || 'Not available',
      'GPS Altitude': exifData.altitude ? `${exifData.altitude}m` : 'Not available',
      'GPS Direction': exifData.GPSImgDirection || 'Not available',
      'GPS Speed': exifData.GPSSpeed || 'Not available',
      'Location': exifData.GPSAreaInformation || 'Not available'
    }

    const timestampInfo = {
      'Date Taken': exifData.DateTimeOriginal || exifData.DateTime || 'Not available',
      'Date Modified': exifData.ModifyDate || 'Not available',
      'Date Digitized': exifData.DateTimeDigitized || 'Not available',
      'Timezone': exifData.OffsetTime || 'Not available',
      'Subseconds': exifData.SubSecTimeOriginal || 'Not available'
    }

    return [
      {
        title: 'Basic Info',
        icon: <Info className="w-4 h-4" />,
        data: basicInfo,
        color: 'purple'
      },
      {
        title: 'Camera Settings',
        icon: <Camera className="w-4 h-4" />,
        data: cameraInfo,
        color: 'blue'
      },
      {
        title: 'Location Data',
        icon: <MapPin className="w-4 h-4" />,
        data: locationInfo,
        color: 'green'
      },
      {
        title: 'Timestamps',
        icon: <Calendar className="w-4 h-4" />,
        data: timestampInfo,
        color: 'orange'
      }
    ]
  }, [file, exifData])

  const hasGPSData = exifData.latitude && exifData.longitude

  const openInGoogleMaps = () => {
    if (hasGPSData) {
      const url = `https://www.google.com/maps?q=${exifData.latitude},${exifData.longitude}`
      window.open(url, '_blank')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const downloadExifData = () => {
    const dataStr = JSON.stringify(exifData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.name}_exif.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const filteredData = useMemo(() => {
    if (!searchTerm) return exifData
    
    const filtered: { [key: string]: unknown } = {}
    Object.entries(exifData).forEach(([key, value]) => {
      if (key.toLowerCase().includes(searchTerm.toLowerCase()) ||
          String(value).toLowerCase().includes(searchTerm.toLowerCase())) {
        filtered[key] = value
      }
    })
    return filtered
  }, [exifData, searchTerm])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Preview */}
        <div className="lg:col-span-1">
          <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-4">Image Preview</h3>
            <div className="flex-1 rounded-lg overflow-hidden bg-black/40 mb-4 min-h-[400px]">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="mt-auto flex flex-col items-center space-y-2">
              <Button onClick={downloadExifData} size="sm" className="px-4 py-2">
                <Download className="w-4 h-4 mr-2" />
                Download EXIF Data
              </Button>
              
              {Boolean(hasGPSData) && (
                <Button onClick={openInGoogleMaps} size="sm" variant="outline" className="px-4 py-2">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Google Maps
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* EXIF Data */}
        <div className="lg:col-span-1">
          <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-4 h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">EXIF Metadata</h3>
              <div className="flex items-center space-x-2">
                <Button
                  onClick={() => setShowRawData(!showRawData)}
                  variant="outline"
                  size="sm"
                >
                  {showRawData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showRawData ? 'Organized' : 'Raw Data'}
                </Button>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              {!showRawData ? (
                <>
                  {/* Section Content */}
                  <div className="flex-1 space-y-3 mb-4 overflow-y-auto">
                    {sections
                      .find(s => s.title.toLowerCase().replace(/\s+/g, '') === activeSection)
                      ?.data && Object.entries(sections.find(s => s.title.toLowerCase().replace(/\s+/g, '') === activeSection)!.data)
                      .filter(([, value]) => value !== undefined && value !== null && value !== '')
                      .map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between py-2 border-b border-gray-700/30">
                          <span className="text-gray-300 font-medium">{key}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-white">{String(value)}</span>
                            <button
                              onClick={() => copyToClipboard(String(value))}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Section Tabs - Moved to bottom */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {sections.map((section) => {
                      const sectionId = section.title.toLowerCase().replace(/\s+/g, '')
                      return (
                        <Button
                          key={section.title}
                          onClick={() => {
                            console.log('Switching to section:', sectionId)
                            setActiveSection(sectionId)
                          }}
                          className={cn(
                            "flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                            activeSection === sectionId
                              ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
                              : "bg-black/20 text-gray-400 hover:text-white hover:bg-black/40"
                          )}
                          variant="ghost"
                          size="sm"
                        >
                          {section.icon}
                          <span>{section.title}</span>
                        </Button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  {/* Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search EXIF data..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-black/40 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Raw Data */}
                  <div className="flex-1 space-y-2 overflow-y-auto">
                    {Object.entries(filteredData).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between py-2 border-b border-gray-700/30">
                        <span className="text-gray-300 font-mono text-sm">{key}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-white text-sm max-w-xs truncate">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(typeof value === 'object' ? JSON.stringify(value) : String(value))}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Map Modal */}
    </div>
  )
}