"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from './ui/button'
import { useExifWorker } from '@/hooks/useExifWorker'
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  MapPin,
  Camera,
  Calendar
} from 'lucide-react'

interface BatchFile {
  id: string
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  exifData?: Record<string, unknown>
  error?: string
  progress?: number
}

interface BatchResults {
  totalFiles: number
  completed: number
  errors: number
  withGPS: number
  cameras: { [key: string]: number }
  dateRange: { earliest?: string; latest?: string }
}

interface BatchProcessorProps {
  currentFile?: File
  currentExifData?: Record<string, unknown>
}

export function BatchProcessor({ currentFile, currentExifData }: BatchProcessorProps) {
  const [files, setFiles] = useState<BatchFile[]>([])
  const [results, setResults] = useState<BatchResults | null>(null)
  const [showResults, setShowResults] = useState(false)
  const { batchProcess, isProcessing } = useExifWorker()

  // Add current file to batch if available
  useEffect(() => {
    if (currentFile && currentExifData && files.length === 0) {
      const currentBatchFile: BatchFile = {
        id: 'current-' + Math.random().toString(36).substr(2, 9),
        file: currentFile,
        status: 'completed',
        exifData: currentExifData,
        progress: 100
      }
      setFiles([currentBatchFile])
      
      // Set initial results for current file
      const cameras: { [key: string]: number } = {}
      const cameraName = `${(currentExifData.Make as string) || ''} ${(currentExifData.Model as string) || ''}`.trim()
      if (cameraName) {
        cameras[cameraName] = 1
      }
      
      setResults({
        totalFiles: 1,
        completed: 1,
        errors: 0,
        withGPS: (currentExifData.latitude as string) ? 1 : 0,
        cameras,
        dateRange: {
          earliest: (currentExifData.DateTimeOriginal as string) || (currentExifData.DateTime as string),
          latest: (currentExifData.DateTimeOriginal as string) || (currentExifData.DateTime as string)
        }
      })
      setShowResults(true)
    }
  }, [currentFile, currentExifData, files.length])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    const newFiles: BatchFile[] = selectedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending'
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setFiles([])
    setResults(null)
    setShowResults(false)
  }, [])

  const processFiles = useCallback(async () => {
    if (files.length === 0) return
    
    try {
      // Set all pending files to processing status
      setFiles(prev => prev.map(f => 
        f.status === 'pending' ? { ...f, status: 'processing' as const, progress: 0 } : f
      ))
      
      // Only process pending files
      const filesToProcess = files.filter(f => f.status === 'pending' || f.status === 'processing')
      if (filesToProcess.length === 0) return
      
      // Use Web Worker for batch processing
      const result = await batchProcess(filesToProcess.map(f => f.file))
      
      // Update files with results
      setFiles(prev => prev.map(fileData => {
        if (fileData.status === 'completed') return fileData // Keep already completed files
        
        const workerResult = result.results.find((r: Record<string, unknown>) => r.fileName === fileData.file.name)
        if (workerResult) {
          return {
            ...fileData,
            status: workerResult.status === 'success' ? 'completed' as const : 'error' as const,
            exifData: workerResult.exifData,
            error: workerResult.error,
            progress: 100
          }
        }
        return fileData
      }))
      
      // Update results with all files
      const allCompleted = files.filter(f => f.status === 'completed' || (result.results.find((r: Record<string, unknown>) => r.fileName === f.file.name && r.status === 'success')))
      const allErrors = files.filter(f => f.status === 'error' || (result.results.find((r: Record<string, unknown>) => r.fileName === f.file.name && r.status === 'error')))
      
      setResults({
        totalFiles: files.length,
        completed: allCompleted.length,
        errors: allErrors.length,
        withGPS: result.summary.withGPS,
        cameras: result.summary.cameras || {},
        dateRange: result.summary.dateRange || {}
      })
      setShowResults(true)
      
    } catch (error) {
      console.error('Batch processing failed:', error)
      // Set all processing files to error status
      setFiles(prev => prev.map(f => ({
        ...f,
        status: f.status === 'processing' ? 'error' as const : f.status,
        error: f.status === 'processing' ? (error instanceof Error ? error.message : 'Processing failed') : f.error
      })))
    }
  }, [files, batchProcess])

  const exportResults = useCallback(() => {
    const exportData = files.map(f => ({
      filename: f.file.name,
      size: f.file.size,
      status: f.status,
      exifData: f.exifData,
      error: f.error
    }))

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `batch_exif_analysis_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }, [files])

  const exportCSV = useCallback(() => {
    const headers = ['Filename', 'Size', 'Status', 'Camera', 'GPS Lat', 'GPS Lng', 'Date Taken', 'ISO', 'Aperture', 'Shutter Speed']
    const rows = files.map(f => [
      f.file.name,
      f.file.size.toString(),
      f.status,
      f.exifData ? `${(f.exifData.Make as string) || ''} ${(f.exifData.Model as string) || ''}`.trim() : '',
      (f.exifData?.latitude as string) || '',
      (f.exifData?.longitude as string) || '',
      (f.exifData?.DateTimeOriginal as string) || (f.exifData?.DateTime as string) || '',
      (f.exifData?.ISO as string) || '',
      f.exifData?.FNumber ? `f/${f.exifData.FNumber as number}` : '',
      f.exifData?.ExposureTime ? `1/${Math.round(1/(f.exifData.ExposureTime as number))}s` : ''
    ])

    const csvContent = [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `batch_exif_analysis_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }, [files])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const pendingFiles = files.filter(f => f.status === 'pending')

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">Batch EXIF Processor</h3>
        </div>
        <div className="flex items-center space-x-2">
          {pendingFiles.length > 0 && (
            <Button
              onClick={processFiles}
              disabled={isProcessing}
              className="flex items-center space-x-2"
            >
              {isProcessing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isProcessing ? 'Processing...' : `Process ${pendingFiles.length} Files`}</span>
            </Button>
          )}
          {files.length > 0 && (
            <Button onClick={clearAll} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Current File Info */}
      {currentFile && (
        <div className="mb-4 p-3 bg-purple-400/10 rounded-lg border border-purple-400/20">
          <p className="text-sm text-purple-300">
            <strong>Current file:</strong> {currentFile.name} has been automatically added to the batch.
          </p>
        </div>
      )}

      {/* File Upload */}
      <div className="mb-6">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-400/30 rounded-lg cursor-pointer hover:border-purple-400/50 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-2 text-purple-300" />
            <p className="mb-2 text-sm text-gray-300">
              <span className="font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-400">Add more image files to the batch</p>
          </div>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Results Summary */}
      {showResults && results && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <div className="text-2xl font-bold text-white">{results.completed}</div>
            <div className="text-sm text-gray-400">Processed</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <div className="text-2xl font-bold text-green-400">{results.withGPS}</div>
            <div className="text-sm text-gray-400">With GPS</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <div className="text-2xl font-bold text-blue-400">{Object.keys(results.cameras).length}</div>
            <div className="text-sm text-gray-400">Cameras</div>
          </div>
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <div className="text-2xl font-bold text-red-400">{results.errors}</div>
            <div className="text-sm text-gray-400">Errors</div>
          </div>
        </div>
      )}

      {/* Export Options */}
      {files.length > 0 && files.some(f => f.status === 'completed') && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Button onClick={exportResults} size="sm">
            <Download className="w-4 h-4 mr-1" />
            Export JSON
          </Button>
          <Button onClick={exportCSV} size="sm" variant="outline">
            <FileText className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.map((fileData) => (
            <div key={fileData.id} className="flex items-center justify-between p-3 bg-black/40 rounded border border-gray-700/30">
              <div className="flex items-center space-x-3 flex-1">
                {getStatusIcon(fileData.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {fileData.file.name}
                    {fileData.id.startsWith('current-') && (
                      <span className="ml-2 text-xs text-purple-400">(Current)</span>
                    )}
                  </div>
                  <div className="text-sm text-gray-400">
                    {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                    {fileData.status === 'processing' && fileData.progress && (
                      <span className="ml-2">({fileData.progress}%)</span>
                    )}
                    {fileData.status === 'error' && fileData.error && (
                      <span className="ml-2 text-red-400">- {fileData.error}</span>
                    )}
                  </div>
                </div>
              </div>
              
              {fileData.status === 'completed' && fileData.exifData && (
                <div className="flex items-center space-x-2 text-xs">
                  {(fileData.exifData.latitude as string) && (
                    <div className="flex items-center text-green-400">
                      <MapPin className="w-3 h-3 mr-1" />
                      GPS
                    </div>
                  )}
                  {(fileData.exifData.Make as string) && (
                    <div className="flex items-center text-blue-400">
                      <Camera className="w-3 h-3 mr-1" />
                      {fileData.exifData.Make as string}
                    </div>
                  )}
                  {(fileData.exifData.DateTimeOriginal as string) && (
                    <div className="flex items-center text-purple-400">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(fileData.exifData.DateTimeOriginal as string).getFullYear()}
                    </div>
                  )}
                </div>
              )}
              
              <Button
                onClick={() => removeFile(fileData.id)}
                variant="ghost"
                size="sm"
                className="ml-2"
                disabled={fileData.id.startsWith('current-')}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Camera Statistics */}
      {showResults && results && Object.keys(results.cameras).length > 0 && (
        <div className="mt-6 bg-black/40 rounded-lg p-4 border border-gray-700/30">
          <h4 className="text-white font-medium mb-3 flex items-center">
            <Camera className="w-4 h-4 mr-2" />
            Camera Distribution
          </h4>
          <div className="space-y-2">
            {Object.entries(results.cameras)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([camera, count]) => (
                <div key={camera} className="flex justify-between items-center">
                  <span className="text-gray-300">{camera}</span>
                  <span className="text-white font-mono">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}