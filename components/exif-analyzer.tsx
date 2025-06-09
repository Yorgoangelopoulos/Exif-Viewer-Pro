"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { FileUpload } from './file-upload'
import { ExifData } from '@/components/exif-data'
import { BatchProcessor } from '@/components/batch-processor'
import { ForensicTools } from '@/components/forensic-tools'
import { AdvancedForensics } from '@/components/advanced-forensics'
import { ExifEditor } from '@/components/exif-editor'
import { MultiExifReader } from '@/components/multi-exif-reader'
import { ELAAnalysis } from '@/components/ela-analysis'
import { HexAnalyzer } from '@/components/hex-analyzer'
import { Button } from './ui/button'
import { ArrowLeft, RotateCcw, FileText, Search, Shield, Zap, Edit, Users, Activity, Binary } from 'lucide-react'
import { cn } from '@/lib/utils'
import exifr from 'exifr'

interface ExifInfo {
  [key: string]: unknown
}

interface AnalyzedFile {
  file: File
  exifData: ExifInfo
  imageUrl: string
  hexData?: {
    lines: Array<{
      offset: string
      hex: string
      ascii: string
    }>
    raw: Uint8Array
    totalBytes: number
    displayedBytes: number
  }
}

interface PersistedData {
  fileName: string
  fileSize: number
  fileType: string
  exifData: ExifInfo
  activeTab: TabType
  imageDataUrl: string
}

type TabType = 'metadata' | 'batch' | 'forensic' | 'advanced' | 'editor' | 'multi' | 'ela' | 'hex'

interface Tab {
  id: TabType
  label: string
  icon: React.ReactNode
  description: string
}

export function ExifAnalyzer() {
  const [analyzedFile, setAnalyzedFile] = useState<AnalyzedFile | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('metadata')
  const [isRestoring, setIsRestoring] = useState(true)

  const tabs: Tab[] = [
    {
      id: 'metadata',
      label: 'Metadata Analysis',
      icon: <FileText className="w-4 h-4" />,
      description: 'Basic EXIF information and metadata'
    },
    {
      id: 'batch',
      label: 'Batch Processing',
      icon: <Users className="w-4 h-4" />,
      description: 'Process multiple files simultaneously'
    },
    {
      id: 'forensic',
      label: 'Forensic Tools',
      icon: <Search className="w-4 h-4" />,
      description: 'Basic forensic analysis tools'
    },
    {
      id: 'advanced',
      label: 'Advanced Forensics',
      icon: <Shield className="w-4 h-4" />,
      description: 'Professional forensic analysis'
    },
    {
      id: 'editor',
      label: 'EXIF Editor',
      icon: <Edit className="w-4 h-4" />,
      description: 'Modify and clean metadata'
    },
    {
      id: 'multi',
      label: 'Multi-Source Analysis',
      icon: <Activity className="w-4 h-4" />,
      description: 'Compare different EXIF readers'
    },
    {
      id: 'ela',
      label: 'ELA Analysis',
      icon: <Zap className="w-4 h-4" />,
      description: 'Error Level Analysis for manipulation detection'
    },
    {
      id: 'hex',
      label: 'Hex Analysis',
      icon: <Binary className="w-4 h-4" />,
      description: 'Advanced hex dump and binary analysis'
    }
  ]

  // Restore state from localStorage on component mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        const persistedData = localStorage.getItem('exif-analyzer-state')
        if (persistedData) {
          const data: PersistedData = JSON.parse(persistedData)
          
          // Convert base64 back to File
          const response = await fetch(data.imageDataUrl)
          const blob = await response.blob()
          const file = new File([blob], data.fileName, { type: data.fileType })
          
          // Create object URL for preview
          const imageUrl = URL.createObjectURL(file)
          
          // Generate hex data
          const hexData = await generateHexData(file)
          
          setAnalyzedFile({
            file,
            exifData: data.exifData,
            imageUrl,
            hexData
          })
          
          setActiveTab(data.activeTab)
        }
      } catch (error) {
        console.error('Failed to restore state:', error)
        // Clear corrupted data
        localStorage.removeItem('exif-analyzer-state')
      } finally {
        setIsRestoring(false)
      }
    }

    restoreState()
  }, [])

  // Save state to localStorage whenever analyzedFile or activeTab changes
  useEffect(() => {
    const saveState = async () => {
      if (analyzedFile && !isRestoring) {
        try {
          // Convert file to base64 for storage
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const img = new Image()
          
          img.onload = () => {
            canvas.width = img.width
            canvas.height = img.height
            ctx?.drawImage(img, 0, 0)
            
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8)
            
            const persistedData: PersistedData = {
              fileName: analyzedFile.file.name,
              fileSize: analyzedFile.file.size,
              fileType: analyzedFile.file.type,
              exifData: analyzedFile.exifData,
              activeTab,
              imageDataUrl
            }
            
            localStorage.setItem('exif-analyzer-state', JSON.stringify(persistedData))
          }
          
          img.src = analyzedFile.imageUrl
        } catch (error) {
          console.error('Failed to save state:', error)
        }
      }
    }

    saveState()
  }, [analyzedFile, activeTab, isRestoring])

  const generateHexData = useCallback(async (file: File) => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const lines = []
    
    for (let i = 0; i < Math.min(uint8Array.length, 4096); i += 16) {
      const chunk = uint8Array.slice(i, i + 16)
      const offset = i.toString(16).padStart(8, '0').toUpperCase()
      const hex = Array.from(chunk)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ')
        .padEnd(47, ' ')
      const ascii = Array.from(chunk)
        .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
        .join('')
      
      lines.push({ offset, hex, ascii })
    }
    
    return { 
      lines, 
      raw: uint8Array,
      totalBytes: uint8Array.length,
      displayedBytes: Math.min(uint8Array.length, 4096)
    }
  }, [])

  const analyzeFile = useCallback(async (file: File) => {
    setIsAnalyzing(true)
    setError(null)

    try {
      // Create image URL for preview
      const imageUrl = URL.createObjectURL(file)

      // Extract EXIF data
      const exifData = await exifr.parse(file, {
        tiff: true,
        exif: true,
        gps: true,
        iptc: true,
        icc: true,
        jfif: true,
        ihdr: true,
        xmp: true,
        pick: undefined // Get all available data
      })

      // Generate hex data for advanced analysis
      const hexData = await generateHexData(file)

      setAnalyzedFile({
        file,
        exifData: exifData || {},
        imageUrl,
        hexData
      })
    } catch (err) {
      console.error('EXIF analysis error:', err)
      setError('Failed to analyze image. The file might not contain EXIF data or be corrupted.')
    } finally {
      setIsAnalyzing(false)
    }
  }, [generateHexData])

  const resetAnalysis = useCallback(() => {
    if (analyzedFile?.imageUrl) {
      URL.revokeObjectURL(analyzedFile.imageUrl)
    }
    setAnalyzedFile(null)
    setError(null)
    setActiveTab('metadata')
    // Clear localStorage
    localStorage.removeItem('exif-analyzer-state')
  }, [analyzedFile])

  const handleExifUpdate = useCallback((newExifData: ExifInfo) => {
    if (analyzedFile) {
      setAnalyzedFile({
        ...analyzedFile,
        exifData: newExifData
      })
    }
  }, [analyzedFile])

  // Show loading while restoring state
  if (isRestoring) {
    return (
      <div className="w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-purple-300">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
            <span>Restoring session...</span>
          </div>
        </div>
      </div>
    )
  }

  if (analyzedFile) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          {/* Simple buttons without extra wrappers */}
          <button 
            onClick={resetAnalysis}
            className="relative inline-block overflow-hidden rounded-full p-[1.5px]"
          >
            <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"></span>
            <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-white dark:bg-gray-950 text-xs font-medium backdrop-blur-3xl">
              <span className="inline-flex rounded-full text-center group items-center w-full justify-center transition-all font-medium cursor-pointer bg-gradient-to-tr from-zinc-300/20 via-purple-400/30 to-transparent dark:from-zinc-300/5 dark:via-purple-400/20 text-gray-900 dark:text-white border-input border-[1px] hover:bg-gradient-to-tr hover:from-zinc-300/30 hover:via-purple-400/40 hover:to-transparent dark:hover:from-zinc-300/10 dark:hover:via-purple-400/30 py-2 px-4 text-sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Upload
              </span>
            </div>
          </button>
          
          <button 
            onClick={() => analyzeFile(analyzedFile.file)}
            className="relative inline-block overflow-hidden rounded-full p-[1.5px]"
          >
            <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"></span>
            <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-white dark:bg-gray-950 text-xs font-medium backdrop-blur-3xl">
              <span className="inline-flex rounded-full text-center group items-center w-full justify-center transition-all font-medium cursor-pointer bg-gradient-to-tr from-zinc-300/20 via-purple-400/30 to-transparent dark:from-zinc-300/5 dark:via-purple-400/20 text-gray-900 dark:text-white border-input border-[1px] hover:bg-gradient-to-tr hover:from-zinc-300/30 hover:via-purple-400/40 hover:to-transparent dark:hover:from-zinc-300/10 dark:hover:via-purple-400/30 py-2 px-4 text-sm">
                <RotateCcw className="w-4 h-4 mr-2" />
                Re-analyze
              </span>
            </div>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative inline-block overflow-hidden rounded-full p-[1.5px]",
                  activeTab === tab.id ? "opacity-100" : "opacity-70 hover:opacity-100"
                )}
              >
                <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"></span>
                <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-white dark:bg-gray-950 text-xs font-medium backdrop-blur-3xl">
                  <span className={cn(
                    "inline-flex rounded-full text-center group items-center w-full justify-center transition-all font-medium cursor-pointer bg-gradient-to-tr from-zinc-300/20 via-purple-400/30 to-transparent dark:from-zinc-300/5 dark:via-purple-400/20 text-gray-900 dark:text-white border-input border-[1px] hover:bg-gradient-to-tr hover:from-zinc-300/30 hover:via-purple-400/40 hover:to-transparent dark:hover:from-zinc-300/10 dark:hover:via-purple-400/30 py-2 px-4 text-sm space-x-2"
                  )}>
                    {tab.icon}
                    <span>{tab.label}</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          {/* Tab Description */}
          <div className="mt-3 pt-3 border-t border-gray-700/30">
            <p className="text-gray-400 text-sm">
              {tabs.find(tab => tab.id === activeTab)?.description}
            </p>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          {activeTab === 'metadata' && (
            <ExifData 
              file={analyzedFile.file}
              exifData={analyzedFile.exifData}
              imageUrl={analyzedFile.imageUrl}
            />
          )}
          
          {activeTab === 'batch' && (
            <BatchProcessor 
              currentFile={analyzedFile.file}
              currentExifData={analyzedFile.exifData}
            />
          )}
          
          {activeTab === 'forensic' && (
            <ForensicTools 
              file={analyzedFile.file}
              imageUrl={analyzedFile.imageUrl}
            />
          )}
          
          {activeTab === 'advanced' && (
            <AdvancedForensics 
              file={analyzedFile.file}
              imageUrl={analyzedFile.imageUrl}
              exifData={analyzedFile.exifData}
            />
          )}
          
          {activeTab === 'editor' && (
            <ExifEditor 
              file={analyzedFile.file}
              exifData={analyzedFile.exifData}
              onExifUpdate={handleExifUpdate}
            />
          )}
          
          {activeTab === 'multi' && (
            <MultiExifReader 
              file={analyzedFile.file}
              imageUrl={analyzedFile.imageUrl}
            />
          )}
          
          {activeTab === 'ela' && (
            <ELAAnalysis 
              file={analyzedFile.file}
              imageUrl={analyzedFile.imageUrl}
            />
          )}
          
          {activeTab === 'hex' && analyzedFile.hexData && (
            <HexAnalyzer 
              hexData={analyzedFile.hexData}
              file={analyzedFile.file}
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-white">
          Professional EXIF Analysis
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Upload your image to extract and analyze comprehensive metadata including GPS location, 
          camera settings, timestamps, and hidden forensic information.
        </p>
      </div>

      <FileUpload 
        onFileSelect={analyzeFile}
        className={isAnalyzing ? 'pointer-events-none opacity-50' : ''}
      />

      {isAnalyzing && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-purple-300">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
            <span>Analyzing image metadata...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-red-400 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}