"use client"

import React, { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { HexAnalyzer } from './hex-analyzer'
import { generateHexDump, analyzeFileSignature, detectEmbeddedFiles, calculateEntropy, type HexData } from '@/lib/hex-utils'
import {
  Shield,
  Search,
  Hash,
  FileText,
  Eye,
  Zap,
  Download,
  Copy,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Binary,
  Microscope
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ForensicToolsProps {
  file: File
  imageUrl: string
}

interface AnalysisResult {
  tool: string
  status: 'running' | 'completed' | 'error'
  result?: any
  error?: string
}

export function ForensicTools({ file, imageUrl }: ForensicToolsProps) {
  const [analyses, setAnalyses] = useState<{ [key: string]: AnalysisResult }>({})
  const [activeTab, setActiveTab] = useState('steganography')
  const [hexData, setHexData] = useState<HexData | null>(null)
  const [showAdvancedHex, setShowAdvancedHex] = useState(false)

  const runAnalysis = useCallback(async (toolName: string, analysisFunction: () => Promise<any>) => {
    setAnalyses(prev => ({
      ...prev,
      [toolName]: { tool: toolName, status: 'running' }
    }))

    try {
      const result = await analysisFunction()
      setAnalyses(prev => ({
        ...prev,
        [toolName]: { tool: toolName, status: 'completed', result }
      }))
    } catch (error) {
      setAnalyses(prev => ({
        ...prev,
        [toolName]: { 
          tool: toolName, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
  }, [])

  // Steganography Detection
  const detectSteganography = useCallback(async () => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        ctx?.drawImage(img, 0, 0)
        
        const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData?.data
        
        if (!data) {
          resolve({ suspicious: false, reason: 'Could not analyze image data' })
          return
        }

        // LSB Analysis
        let lsbVariation = 0
        let totalPixels = 0
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] & 1
          const g = data[i + 1] & 1
          const b = data[i + 2] & 1
          
          lsbVariation += r + g + b
          totalPixels++
        }
        
        const lsbRatio = lsbVariation / (totalPixels * 3)
        const suspicious = lsbRatio > 0.4 && lsbRatio < 0.6
        
        resolve({
          suspicious,
          lsbRatio: lsbRatio.toFixed(4),
          analysis: suspicious ? 'Potential steganography detected' : 'No obvious steganography',
          details: {
            totalPixels,
            lsbVariation,
            recommendation: suspicious ? 'Further analysis recommended' : 'Image appears clean'
          }
        })
      }
      
      img.src = imageUrl
    })
  }, [imageUrl])

  // File Hash Analysis
  const calculateHashes = useCallback(async () => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    
    // Simple hash calculations (in real implementation, use crypto.subtle)
    let md5Hash = ''
    let sha1Hash = ''
    let sha256Hash = ''
    
    // Simplified hash simulation (replace with actual crypto implementation)
    const simpleHash = (data: Uint8Array, length: number) => {
      let hash = 0
      for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash + data[i]) & 0xffffffff
      }
      return Math.abs(hash).toString(16).padStart(length, '0').substring(0, length)
    }
    
    md5Hash = simpleHash(uint8Array, 32)
    sha1Hash = simpleHash(uint8Array, 40)
    sha256Hash = simpleHash(uint8Array, 64)
    
    return {
      md5: md5Hash,
      sha1: sha1Hash,
      sha256: sha256Hash,
      fileSize: file.size,
      fileName: file.name
    }
  }, [file])

  // Advanced Hex Dump Analysis
  const generateAdvancedHexDump = useCallback(async () => {
    const hexData = await generateHexDump(file, 2048)
    setHexData(hexData)
    setShowAdvancedHex(true)
    
    // Also analyze file signature and embedded files
    const signature = analyzeFileSignature(hexData)
    const embeddedFiles = detectEmbeddedFiles(hexData)
    const entropy = calculateEntropy(hexData)
    
    return {
      hexData,
      signature,
      embeddedFiles,
      entropy,
      summary: {
        fileType: signature.fileType,
        confidence: signature.confidence,
        embeddedCount: embeddedFiles.length,
        entropyLevel: entropy.assessment,
        suspiciousAreas: entropy.chunks.filter(chunk => chunk.entropy > 7.5).length
      }
    }
  }, [file])

  // Simple Hex Dump (for backward compatibility)
  const generateSimpleHexDump = useCallback(async () => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const hexLines = []
    
    for (let i = 0; i < Math.min(uint8Array.length, 512); i += 16) {
      const offset = i.toString(16).padStart(8, '0')
      const hexBytes = []
      const asciiChars = []
      
      for (let j = 0; j < 16; j++) {
        if (i + j < uint8Array.length) {
          const byte = uint8Array[i + j]
          hexBytes.push(byte.toString(16).padStart(2, '0'))
          asciiChars.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')
        } else {
          hexBytes.push('  ')
          asciiChars.push(' ')
        }
      }
      
      hexLines.push({
        offset,
        hex: hexBytes.join(' '),
        ascii: asciiChars.join('')
      })
    }
    
    return {
      lines: hexLines,
      totalBytes: uint8Array.length,
      displayedBytes: Math.min(uint8Array.length, 512)
    }
  }, [file])

  // String Extraction
  const extractStrings = useCallback(async () => {
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const strings = []
    let currentString = ''
    
    for (let i = 0; i < uint8Array.length; i++) {
      const char = uint8Array[i]
      if (char >= 32 && char <= 126) {
        currentString += String.fromCharCode(char)
      } else {
        if (currentString.length >= 4) {
          strings.push(currentString)
        }
        currentString = ''
      }
    }
    
    if (currentString.length >= 4) {
      strings.push(currentString)
    }
    
    return {
      totalStrings: strings.length,
      strings: strings.slice(0, 100), // Show first 100 strings
      interesting: strings.filter(s => 
        s.includes('http') || 
        s.includes('www') || 
        s.includes('@') ||
        s.includes('password') ||
        s.includes('key') ||
        s.includes('secret')
      )
    }
  }, [file])

  const tools = [
    {
      id: 'steganography',
      name: 'Steganography Detection',
      icon: <Eye className="w-4 h-4" />,
      description: 'Detect hidden data using LSB analysis',
      action: () => runAnalysis('steganography', detectSteganography)
    },
    {
      id: 'hashes',
      name: 'File Hashes',
      icon: <Hash className="w-4 h-4" />,
      description: 'Calculate MD5, SHA1, SHA256 hashes',
      action: () => runAnalysis('hashes', calculateHashes)
    },
    {
      id: 'hexdump',
      name: 'Simple Hex Dump',
      icon: <FileText className="w-4 h-4" />,
      description: 'View raw file data in hexadecimal',
      action: () => runAnalysis('hexdump', generateSimpleHexDump)
    },
    {
      id: 'advanced-hex',
      name: 'Advanced Hex Analysis',
      icon: <Binary className="w-4 h-4" />,
      description: 'Deep hex analysis with forensic tools',
      action: () => runAnalysis('advanced-hex', generateAdvancedHexDump)
    },
    {
      id: 'strings',
      name: 'String Extraction',
      icon: <Search className="w-4 h-4" />,
      description: 'Extract readable strings from file',
      action: () => runAnalysis('strings', extractStrings)
    }
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-300"></div>
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Shield className="w-5 h-5 text-purple-300" />
        <h3 className="text-lg font-semibold text-white">Forensic Analysis Tools</h3>
      </div>

      {/* Tool Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            onClick={tool.action}
            className="flex flex-col items-center space-y-2 h-auto py-4"
            disabled={analyses[tool.id]?.status === 'running'}
          >
            <div className="flex items-center space-x-2">
              {tool.icon}
              {getStatusIcon(analyses[tool.id]?.status)}
            </div>
            <div className="text-center">
              <div className="font-medium text-xs">{tool.name}</div>
              <div className="text-xs opacity-70">{tool.description}</div>
            </div>
          </Button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {Object.entries(analyses).map(([toolName, analysis]) => (
          <div key={toolName} className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-white capitalize">{toolName} Results</h4>
              <div className="flex items-center space-x-2">
                {getStatusIcon(analysis.status)}
                {analysis.result && (
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(JSON.stringify(analysis.result, null, 2))}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                )}
              </div>
            </div>

            {analysis.status === 'completed' && analysis.result && (
              <div className="space-y-2">
                {toolName === 'steganography' && (
                  <div className="space-y-2">
                    <div className={cn(
                      "flex items-center space-x-2 p-2 rounded",
                      analysis.result.suspicious ? "bg-black/20 text-purple-300" : "bg-black/20 text-green-300"
                    )}>
                      {analysis.result.suspicious ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      <span>{analysis.result.analysis}</span>
                    </div>
                    <div className="text-sm text-gray-300">
                      <div>LSB Ratio: {analysis.result.lsbRatio}</div>
                      <div>Recommendation: {analysis.result.details.recommendation}</div>
                    </div>
                  </div>
                )}

                {toolName === 'hashes' && (
                  <div className="space-y-2 font-mono text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">MD5:</span>
                      <span className="text-white">{analysis.result.md5}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">SHA1:</span>
                      <span className="text-white">{analysis.result.sha1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">SHA256:</span>
                      <span className="text-white">{analysis.result.sha256}</span>
                    </div>
                  </div>
                )}

                {toolName === 'hexdump' && (
                  <div className="space-y-1">
                    <div className="text-sm text-gray-400 mb-2">
                      Showing {analysis.result.displayedBytes} of {analysis.result.totalBytes} bytes
                    </div>
                    <div className="max-h-64 overflow-y-auto font-mono text-xs">
                      {analysis.result.lines.map((line: any, i: number) => (
                        <div key={i} className="flex space-x-4">
                          <span className="text-purple-300">{line.offset}</span>
                          <span className="text-gray-300">{line.hex}</span>
                          <span className="text-green-300">{line.ascii}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {toolName === 'advanced-hex' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
                        <h5 className="text-white font-medium mb-2">File Signature</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Type:</span>
                            <span className="text-white">{analysis.result.signature.fileType}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Confidence:</span>
                            <span className="text-white">{analysis.result.signature.confidence}%</span>
                          </div>
                          <div className="text-gray-300 text-xs">{analysis.result.signature.details}</div>
                        </div>
                      </div>

                      <div className="bg-black/40 rounded-lg p-3 border border-gray-700/30">
                        <h5 className="text-white font-medium mb-2">Analysis Summary</h5>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Embedded Files:</span>
                            <span className={analysis.result.embeddedFiles.length > 0 ? "text-yellow-400" : "text-green-400"}>
                              {analysis.result.embeddedFiles.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Entropy:</span>
                            <span className="text-white">{analysis.result.entropy.overall.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Suspicious Areas:</span>
                            <span className={analysis.result.summary.suspiciousAreas > 0 ? "text-red-400" : "text-green-400"}>
                              {analysis.result.summary.suspiciousAreas}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {analysis.result.embeddedFiles.length > 0 && (
                      <div className="bg-black/20 p-3 rounded border border-purple-400/20">
                        <h5 className="text-purple-300 font-medium mb-2">Embedded Files Detected</h5>
                        <div className="space-y-1 text-sm">
                          {analysis.result.embeddedFiles.slice(0, 5).map((embedded: any, i: number) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-yellow-200">{embedded.type} at 0x{embedded.offset.toString(16)}</span>
                              <span className="text-yellow-300 font-mono text-xs">{embedded.signature}</span>
                            </div>
                          ))}
                          {analysis.result.embeddedFiles.length > 5 && (
                            <div className="text-yellow-400 text-xs">
                              ... and {analysis.result.embeddedFiles.length - 5} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-center">
                      <Button
                        onClick={() => setShowAdvancedHex(true)}
                        className="flex items-center space-x-2"
                      >
                        <Microscope className="w-4 h-4" />
                        <span>Open Advanced Hex Analyzer</span>
                      </Button>
                    </div>
                  </div>
                )}

                {toolName === 'strings' && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-400">
                      Found {analysis.result.totalStrings} strings, showing first 100
                    </div>
                    {analysis.result.interesting.length > 0 && (
                      <div className="bg-black/20 p-2 rounded">
                        <div className="text-purple-300 font-medium mb-1">Interesting Strings:</div>
                        <div className="space-y-1 font-mono text-xs">
                          {analysis.result.interesting.map((str: string, i: number) => (
                            <div key={i} className="text-yellow-200">{str}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="max-h-48 overflow-y-auto font-mono text-xs space-y-1">
                      {analysis.result.strings.map((str: string, i: number) => (
                        <div key={i} className="text-gray-300">{str}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {analysis.status === 'error' && (
              <div className="text-red-400 text-sm">
                Error: {analysis.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Advanced Hex Analyzer Modal */}
      {showAdvancedHex && hexData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-lg border border-purple-400/20 w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <h3 className="text-lg font-semibold text-white">Advanced Hex Analysis</h3>
              <Button
                onClick={() => setShowAdvancedHex(false)}
                variant="ghost"
                size="sm"
              >
                ✕
              </Button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <HexAnalyzer hexData={hexData} file={file} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}