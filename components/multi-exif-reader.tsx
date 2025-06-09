"use client"

import React, { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { 
  Database, 
  Layers, 
  FileText, 
  Camera, 
  MapPin,
  Clock,
  Settings,
  Info,
  AlertTriangle,
  CheckCircle,
  Copy,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'
import exifr from 'exifr'

interface MultiExifReaderProps {
  file: File
  imageUrl: string
}

interface ExifSource {
  name: string
  library: string
  data: any
  status: 'loading' | 'success' | 'error'
  error?: string
  coverage: number
  unique_fields: number
}

interface ConsolidatedData {
  [key: string]: {
    value: any
    sources: string[]
    confidence: number
    conflicts?: { source: string; value: any }[]
  }
}

export function MultiExifReader({ file, imageUrl }: MultiExifReaderProps) {
  const [exifSources, setExifSources] = useState<{ [key: string]: ExifSource }>({})
  const [consolidatedData, setConsolidatedData] = useState<ConsolidatedData>({})
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeView, setActiveView] = useState<'sources' | 'consolidated' | 'conflicts'>('sources')

  const analyzeWithMultipleLibraries = useCallback(async () => {
    setIsAnalyzing(true)
    const sources: { [key: string]: ExifSource } = {}

    // 1. exifr (Primary - most comprehensive)
    try {
      sources.exifr = {
        name: 'ExifR',
        library: 'exifr',
        data: {},
        status: 'loading',
        coverage: 0,
        unique_fields: 0
      }
      setExifSources({ ...sources })

      const exifrData = await exifr.parse(file, {
        tiff: true,
        exif: true,
        gps: true,
        iptc: true,
        icc: true,
        jfif: true,
        ihdr: true,
        xmp: true,
        pick: undefined
      })

      sources.exifr = {
        ...sources.exifr,
        data: exifrData || {},
        status: 'success',
        coverage: calculateCoverage(exifrData || {}),
        unique_fields: Object.keys(exifrData || {}).length
      }
    } catch (error) {
      sources.exifr = {
        ...sources.exifr,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // 2. Manual EXIF parsing (for raw data)
    try {
      sources.manual = {
        name: 'Manual Parser',
        library: 'custom',
        data: {},
        status: 'loading',
        coverage: 0,
        unique_fields: 0
      }
      setExifSources({ ...sources })

      const manualData = await parseExifManually(file)
      sources.manual = {
        ...sources.manual,
        data: manualData,
        status: 'success',
        coverage: calculateCoverage(manualData),
        unique_fields: Object.keys(manualData).length
      }
    } catch (error) {
      sources.manual = {
        ...sources.manual,
        status: 'error',
        error: error instanceof Error ? error.message : 'Manual parsing failed'
      }
    }

    // 3. Binary analysis for hidden data
    try {
      sources.binary = {
        name: 'Binary Analysis',
        library: 'custom',
        data: {},
        status: 'loading',
        coverage: 0,
        unique_fields: 0
      }
      setExifSources({ ...sources })

      const binaryData = await analyzeBinaryStructure(file)
      sources.binary = {
        ...sources.binary,
        data: binaryData,
        status: 'success',
        coverage: calculateCoverage(binaryData),
        unique_fields: Object.keys(binaryData).length
      }
    } catch (error) {
      sources.binary = {
        ...sources.binary,
        status: 'error',
        error: error instanceof Error ? error.message : 'Binary analysis failed'
      }
    }

    // 4. XMP extraction
    try {
      sources.xmp = {
        name: 'XMP Parser',
        library: 'custom',
        data: {},
        status: 'loading',
        coverage: 0,
        unique_fields: 0
      }
      setExifSources({ ...sources })

      const xmpData = await extractXMPData(file)
      sources.xmp = {
        ...sources.xmp,
        data: xmpData,
        status: 'success',
        coverage: calculateCoverage(xmpData),
        unique_fields: Object.keys(xmpData).length
      }
    } catch (error) {
      sources.xmp = {
        ...sources.xmp,
        status: 'error',
        error: error instanceof Error ? error.message : 'XMP extraction failed'
      }
    }

    setExifSources(sources)

    // Consolidate data from all sources
    const consolidated = consolidateExifData(sources)
    setConsolidatedData(consolidated)
    setIsAnalyzing(false)
  }, [file])

  const calculateCoverage = (data: any): number => {
    const totalPossibleFields = 200 // Approximate total EXIF fields
    const foundFields = Object.keys(data).length
    return Math.min((foundFields / totalPossibleFields) * 100, 100)
  }

  const consolidateExifData = (sources: { [key: string]: ExifSource }): ConsolidatedData => {
    const consolidated: ConsolidatedData = {}
    const allFields = new Set<string>()

    // Collect all unique field names
    Object.values(sources).forEach(source => {
      if (source.status === 'success') {
        Object.keys(source.data).forEach(field => allFields.add(field))
      }
    })

    // For each field, consolidate data from all sources
    allFields.forEach(field => {
      const fieldData: { source: string; value: any }[] = []
      
      Object.entries(sources).forEach(([sourceName, source]) => {
        if (source.status === 'success' && source.data[field] !== undefined) {
          fieldData.push({ source: sourceName, value: source.data[field] })
        }
      })

      if (fieldData.length > 0) {
        // Determine the most reliable value
        const primaryValue = fieldData[0].value
        const conflicts = fieldData.slice(1).filter(item => 
          JSON.stringify(item.value) !== JSON.stringify(primaryValue)
        )

        consolidated[field] = {
          value: primaryValue,
          sources: fieldData.map(item => item.source),
          confidence: calculateFieldConfidence(fieldData),
          ...(conflicts.length > 0 && { conflicts })
        }
      }
    })

    return consolidated
  }

  const calculateFieldConfidence = (fieldData: { source: string; value: any }[]): number => {
    // Higher confidence if multiple sources agree
    const uniqueValues = new Set(fieldData.map(item => JSON.stringify(item.value)))
    const agreement = (fieldData.length - uniqueValues.size + 1) / fieldData.length
    return Math.round(agreement * 100)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const exportConsolidatedData = () => {
    const exportData = {
      sources: Object.fromEntries(
        Object.entries(exifSources).map(([key, source]) => [
          key, 
          { 
            name: source.name, 
            library: source.library, 
            status: source.status, 
            coverage: source.coverage,
            unique_fields: source.unique_fields,
            data: source.data 
          }
        ])
      ),
      consolidated: consolidatedData,
      analysis: {
        total_unique_fields: Object.keys(consolidatedData).length,
        conflicts: Object.values(consolidatedData).filter(field => field.conflicts).length,
        avg_confidence: Math.round(
          Object.values(consolidatedData).reduce((sum, field) => sum + field.confidence, 0) / 
          Object.keys(consolidatedData).length
        )
      }
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.name}_multi_exif_analysis.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-400'
    if (confidence >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Database className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">Multi-Source EXIF Analysis</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={exportConsolidatedData} size="sm" disabled={Object.keys(consolidatedData).length === 0}>
            <Download className="w-4 h-4 mr-1" />
            Export Analysis
          </Button>
          <Button onClick={analyzeWithMultipleLibraries} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Layers className="w-4 h-4 mr-2" />
            )}
            {isAnalyzing ? 'Analyzing...' : 'Analyze with Multiple Sources'}
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveView('sources')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeView === 'sources'
              ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
              : "bg-black/20 text-gray-400 hover:text-white hover:bg-black/40"
          )}
        >
          <Database className="w-4 h-4" />
          <span>Sources Overview</span>
        </button>
        <button
          onClick={() => setActiveView('consolidated')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeView === 'consolidated'
              ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
              : "bg-black/20 text-gray-400 hover:text-white hover:bg-black/40"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Consolidated Data</span>
        </button>
        <button
          onClick={() => setActiveView('conflicts')}
          className={cn(
            "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeView === 'conflicts'
              ? "bg-purple-400/20 text-purple-300 border border-purple-400/30"
              : "bg-black/20 text-gray-400 hover:text-white hover:bg-black/40"
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Conflicts</span>
          {Object.values(consolidatedData).filter(field => field.conflicts).length > 0 && (
            <span className="bg-red-400/20 text-red-300 px-2 py-1 rounded text-xs">
              {Object.values(consolidatedData).filter(field => field.conflicts).length}
            </span>
          )}
        </button>
      </div>

      {/* Content based on active view */}
      {activeView === 'sources' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(exifSources).map(([key, source]) => (
            <div key={key} className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium text-white">{source.name}</h4>
                  {getStatusIcon(source.status)}
                </div>
                <span className="text-xs text-gray-400">{source.library}</span>
              </div>
              
              {source.status === 'success' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Coverage:</span>
                    <span className="text-white">{source.coverage.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Fields Found:</span>
                    <span className="text-white">{source.unique_fields}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-purple-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${source.coverage}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {source.status === 'error' && (
                <div className="text-red-400 text-sm">
                  Error: {source.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeView === 'consolidated' && (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {Object.entries(consolidatedData).map(([field, data]) => (
            <div key={field} className="flex items-center justify-between py-3 px-4 bg-black/40 rounded-lg border border-gray-700/30">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium text-gray-300">{field}</span>
                  <span className={cn("text-xs font-medium", getConfidenceColor(data.confidence))}>
                    {data.confidence}%
                  </span>
                </div>
                <div className="text-sm text-white">{String(data.value)}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Sources: {data.sources.join(', ')}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(String(data.value))}
                className="text-gray-400 hover:text-white transition-colors ml-2"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeView === 'conflicts' && (
        <div className="space-y-3">
          {Object.entries(consolidatedData)
            .filter(([_, data]) => data.conflicts && data.conflicts.length > 0)
            .map(([field, data]) => (
              <div key={field} className="bg-red-400/10 border border-red-400/20 rounded-lg p-4">
                <h4 className="font-medium text-red-300 mb-2">{field}</h4>
                <div className="space-y-2">
                  <div className="text-sm">
                    <span className="text-gray-400">Primary Value:</span>
                    <span className="text-white ml-2">{String(data.value)}</span>
                  </div>
                  {data.conflicts?.map((conflict, index) => (
                    <div key={index} className="text-sm">
                      <span className="text-gray-400">{conflict.source}:</span>
                      <span className="text-yellow-300 ml-2">{String(conflict.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          {Object.values(consolidatedData).filter(field => field.conflicts).length === 0 && (
            <div className="text-center text-gray-400 py-8">
              No conflicts detected between sources
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper functions for different parsing methods
async function parseExifManually(file: File): Promise<any> {
  const arrayBuffer = await file.arrayBuffer()
  const dataView = new DataView(arrayBuffer)
  
  // Basic JPEG EXIF parsing
  const result: any = {}
  
  // Look for EXIF marker (0xFFE1)
  let offset = 0
  while (offset < dataView.byteLength - 1) {
    if (dataView.getUint16(offset) === 0xFFE1) {
      // Found EXIF segment
      const segmentLength = dataView.getUint16(offset + 2)
      const exifData = new Uint8Array(arrayBuffer, offset + 4, segmentLength - 2)
      
      // Parse EXIF data manually
      result.manual_exif_segment_found = true
      result.manual_exif_segment_size = segmentLength
      result.manual_exif_offset = offset
      
      break
    }
    offset++
  }
  
  return result
}

async function analyzeBinaryStructure(file: File): Promise<any> {
  const arrayBuffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)
  
  const result: any = {}
  
  // File signature analysis
  const signature = Array.from(uint8Array.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  result.file_signature = signature
  result.file_size = file.size
  
  // Look for embedded files or unusual patterns
  const patterns = [
    { name: 'JPEG_SOI', pattern: [0xFF, 0xD8] },
    { name: 'PNG_SIGNATURE', pattern: [0x89, 0x50, 0x4E, 0x47] },
    { name: 'PDF_SIGNATURE', pattern: [0x25, 0x50, 0x44, 0x46] },
    { name: 'ZIP_SIGNATURE', pattern: [0x50, 0x4B, 0x03, 0x04] }
  ]
  
  const foundPatterns: string[] = []
  patterns.forEach(({ name, pattern }) => {
    for (let i = 0; i < uint8Array.length - pattern.length; i++) {
      let match = true
      for (let j = 0; j < pattern.length; j++) {
        if (uint8Array[i + j] !== pattern[j]) {
          match = false
          break
        }
      }
      if (match) {
        foundPatterns.push(`${name}_at_${i}`)
      }
    }
  })
  
  result.embedded_patterns = foundPatterns
  
  return result
}

async function extractXMPData(file: File): Promise<any> {
  const text = await file.text()
  const result: any = {}
  
  // Look for XMP data in the file
  const xmpStart = text.indexOf('<x:xmpmeta')
  const xmpEnd = text.indexOf('</x:xmpmeta>')
  
  if (xmpStart !== -1 && xmpEnd !== -1) {
    const xmpData = text.substring(xmpStart, xmpEnd + 12)
    result.xmp_found = true
    result.xmp_size = xmpData.length
    result.xmp_start_offset = xmpStart
    
    // Extract some basic XMP fields
    const titleMatch = xmpData.match(/<dc:title[^>]*>([^<]*)<\/dc:title>/)
    if (titleMatch) result.xmp_title = titleMatch[1]
    
    const creatorMatch = xmpData.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/)
    if (creatorMatch) result.xmp_creator = creatorMatch[1]
  } else {
    result.xmp_found = false
  }
  
  return result
}