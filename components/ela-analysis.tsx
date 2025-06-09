"use client"

import React, { useState, useCallback, useRef } from 'react'
import { Button } from './ui/button'
import { 
  Zap, 
  Download, 
  Eye, 
  EyeOff, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  Info,
  Sliders
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ELAAnalysisProps {
  file: File
  imageUrl: string
}

interface ELAResult {
  canvas: HTMLCanvasElement
  suspiciousAreas: Array<{
    x: number
    y: number
    width: number
    height: number
    confidence: number
  }>
  overallScore: number
  analysis: string
}

export function ELAAnalysis({ file, imageUrl }: ELAAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState<ELAResult | null>(null)
  const [showOriginal, setShowOriginal] = useState(true)
  const [quality, setQuality] = useState(90)
  const [threshold, setThreshold] = useState(15)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const originalCanvasRef = useRef<HTMLCanvasElement>(null)

  const performELA = useCallback(async () => {
    if (!canvasRef.current || !originalCanvasRef.current) return

    setIsAnalyzing(true)
    
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      const canvas = canvasRef.current
      const originalCanvas = originalCanvasRef.current
      const ctx = canvas.getContext('2d')!
      const originalCtx = originalCanvas.getContext('2d')!

      // Set canvas dimensions
      canvas.width = img.width
      canvas.height = img.height
      originalCanvas.width = img.width
      originalCanvas.height = img.height

      // Draw original image
      originalCtx.drawImage(img, 0, 0)
      
      // Create a temporary canvas for JPEG compression
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')!
      tempCanvas.width = img.width
      tempCanvas.height = img.height
      tempCtx.drawImage(img, 0, 0)

      // Convert to JPEG with specified quality and back to get compressed version
      const compressedDataUrl = tempCanvas.toDataURL('image/jpeg', quality / 100)
      const compressedImg = new Image()
      
      await new Promise((resolve, reject) => {
        compressedImg.onload = resolve
        compressedImg.onerror = reject
        compressedImg.src = compressedDataUrl
      })

      // Draw compressed image to temp canvas
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      tempCtx.drawImage(compressedImg, 0, 0)

      // Get image data for both original and compressed
      const originalData = originalCtx.getImageData(0, 0, canvas.width, canvas.height)
      const compressedData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
      const elaData = ctx.createImageData(canvas.width, canvas.height)

      // Calculate ELA
      const suspiciousAreas: Array<{x: number, y: number, width: number, height: number, confidence: number}> = []
      let totalDifference = 0
      let maxDifference = 0

      for (let i = 0; i < originalData.data.length; i += 4) {
        const rDiff = Math.abs(originalData.data[i] - compressedData.data[i])
        const gDiff = Math.abs(originalData.data[i + 1] - compressedData.data[i + 1])
        const bDiff = Math.abs(originalData.data[i + 2] - compressedData.data[i + 2])
        
        const avgDiff = (rDiff + gDiff + bDiff) / 3
        totalDifference += avgDiff
        maxDifference = Math.max(maxDifference, avgDiff)

        // Amplify the difference for visualization
        const amplified = Math.min(255, avgDiff * 10)
        
        elaData.data[i] = amplified     // R
        elaData.data[i + 1] = amplified // G
        elaData.data[i + 2] = amplified // B
        elaData.data[i + 3] = 255       // A
      }

      // Put ELA data to canvas
      ctx.putImageData(elaData, 0, 0)

      // Detect suspicious areas (simplified algorithm)
      const blockSize = 32
      for (let y = 0; y < canvas.height - blockSize; y += blockSize) {
        for (let x = 0; x < canvas.width - blockSize; x += blockSize) {
          const blockData = ctx.getImageData(x, y, blockSize, blockSize)
          let blockAvg = 0
          
          for (let i = 0; i < blockData.data.length; i += 4) {
            blockAvg += blockData.data[i] // Use red channel
          }
          blockAvg /= (blockSize * blockSize)
          
          if (blockAvg > threshold) {
            suspiciousAreas.push({
              x,
              y,
              width: blockSize,
              height: blockSize,
              confidence: Math.min(100, (blockAvg / 255) * 100)
            })
          }
        }
      }

      // Calculate overall score
      const avgDifference = totalDifference / (originalData.data.length / 4)
      const overallScore = Math.min(100, (avgDifference / 50) * 100)

      // Generate analysis
      let analysis = ''
      if (overallScore < 10) {
        analysis = 'Low manipulation probability. Image appears authentic.'
      } else if (overallScore < 30) {
        analysis = 'Moderate manipulation probability. Some areas may have been edited.'
      } else if (overallScore < 60) {
        analysis = 'High manipulation probability. Significant editing detected.'
      } else {
        analysis = 'Very high manipulation probability. Extensive editing detected.'
      }

      setResult({
        canvas: canvas.cloneNode(true) as HTMLCanvasElement,
        suspiciousAreas,
        overallScore,
        analysis
      })

    } catch (error) {
      console.error('ELA analysis failed:', error)
    } finally {
      setIsAnalyzing(false)
    }
  }, [imageUrl, quality, threshold])

  const downloadELA = useCallback(() => {
    if (!canvasRef.current) return
    
    const link = document.createElement('a')
    link.download = `${file.name}_ela.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
  }, [file.name])

  const getSeverityColor = (score: number) => {
    if (score < 10) return 'text-green-400 bg-green-400/10 border-green-400/20'
    if (score < 30) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
    if (score < 60) return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    return 'text-red-400 bg-red-400/10 border-red-400/20'
  }

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">Error Level Analysis (ELA)</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={performELA}
            disabled={isAnalyzing}
            className="flex items-center space-x-2"
          >
            {isAnalyzing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Zap className="w-4 h-4" />
            )}
            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze'}</span>
          </Button>
          {result && (
            <Button onClick={downloadELA} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
          <label className="block text-white font-medium mb-2">
            <Sliders className="w-4 h-4 inline mr-2" />
            JPEG Quality: {quality}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-gray-400 mt-1">
            Lower quality = more sensitive detection
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
          <label className="block text-white font-medium mb-2">
            <Settings className="w-4 h-4 inline mr-2" />
            Detection Threshold: {threshold}
          </label>
          <input
            type="range"
            min="5"
            max="50"
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-gray-400 mt-1">
            Lower threshold = more sensitive detection
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Analysis Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={cn(
              "p-4 rounded-lg border",
              getSeverityColor(result.overallScore)
            )}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Manipulation Score</span>
                {result.overallScore < 30 ? 
                  <CheckCircle className="w-5 h-5" /> : 
                  <AlertTriangle className="w-5 h-5" />
                }
              </div>
              <div className="text-2xl font-bold">{result.overallScore.toFixed(1)}%</div>
              <div className="text-sm opacity-80 mt-1">{result.analysis}</div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <div className="text-white font-medium mb-2">Suspicious Areas</div>
              <div className="text-2xl font-bold text-white">{result.suspiciousAreas.length}</div>
              <div className="text-sm text-gray-400 mt-1">
                Areas with high error levels
              </div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <div className="text-white font-medium mb-2">Confidence</div>
              <div className="text-2xl font-bold text-white">
                {result.suspiciousAreas.length > 0 ? 
                  Math.max(...result.suspiciousAreas.map(a => a.confidence)).toFixed(1) : 
                  '0'
                }%
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Highest area confidence
              </div>
            </div>
          </div>

          {/* Image Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-white font-medium">Original Image</h4>
                <Button
                  onClick={() => setShowOriginal(!showOriginal)}
                  size="sm"
                  variant="ghost"
                >
                  {showOriginal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <div className="aspect-square bg-black/40 rounded-lg overflow-hidden border border-gray-700/30">
                <canvas
                  ref={originalCanvasRef}
                  className={cn(
                    "w-full h-full object-contain",
                    !showOriginal && "hidden"
                  )}
                />
                {!showOriginal && (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    Original hidden
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-white font-medium">ELA Result</h4>
              <div className="aspect-square bg-black/40 rounded-lg overflow-hidden border border-gray-700/30 relative">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain"
                />
                {/* Overlay suspicious areas */}
                {result.suspiciousAreas.map((area, index) => (
                  <div
                    key={index}
                    className="absolute border-2 border-red-400 bg-red-400/20"
                    style={{
                      left: `${(area.x / (canvasRef.current?.width || 1)) * 100}%`,
                      top: `${(area.y / (canvasRef.current?.height || 1)) * 100}%`,
                      width: `${(area.width / (canvasRef.current?.width || 1)) * 100}%`,
                      height: `${(area.height / (canvasRef.current?.height || 1)) * 100}%`,
                    }}
                    title={`Confidence: ${area.confidence.toFixed(1)}%`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Suspicious Areas List */}
          {result.suspiciousAreas.length > 0 && (
            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-white font-medium mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Suspicious Areas Details
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {result.suspiciousAreas
                  .sort((a, b) => b.confidence - a.confidence)
                  .slice(0, 10)
                  .map((area, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <span className="text-gray-300">
                        Area {index + 1}: ({area.x}, {area.y}) - {area.width}×{area.height}
                      </span>
                      <span className={cn(
                        "font-mono px-2 py-1 rounded",
                        area.confidence > 70 ? "text-red-300 bg-red-400/20" :
                        area.confidence > 40 ? "text-yellow-300 bg-yellow-400/20" :
                        "text-orange-300 bg-orange-400/20"
                      )}>
                        {area.confidence.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-400/10 rounded-lg p-4 border border-blue-400/20">
            <div className="flex items-start space-x-2">
              <Info className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="text-blue-300 text-sm">
                <div className="font-medium mb-1">About Error Level Analysis (ELA)</div>
                <div className="text-blue-200">
                  ELA detects image manipulation by analyzing compression artifacts. 
                  Edited areas often have different error levels than the original image. 
                  White/bright areas in the ELA result indicate potential manipulation.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}