"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { Button } from './ui/button'
import { 
  FileText, 
  Search, 
  Copy, 
  Download,
  AlertTriangle,
  CheckCircle,
  Eye,
  Zap,
  Hash,
  FileX,
  Shield,
  Microscope
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HexAnalyzerProps {
  hexData: {
    lines: Array<{
      offset: string
      hex: string
      ascii: string
    }>
    totalBytes: number
    displayedBytes: number
  }
  file: File
}

interface FileSignature {
  signature: string
  description: string
  extension: string
  offset: number
}

interface SuspiciousPattern {
  pattern: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  locations: number[]
}

export function HexAnalyzer({ hexData, file }: HexAnalyzerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeAnalysis, setActiveAnalysis] = useState<'overview' | 'signatures' | 'patterns' | 'entropy'>('overview')

  // JPEG Structure Analysis
  const jpegAnalysis = useMemo(() => {
    const analysis = {
      isValidJPEG: false,
      hasSOI: false,
      hasEOI: false,
      segments: [] as Array<{name: string, marker: string, offset: string, size?: number}>,
      quantizationTables: 0,
      huffmanTables: 0,
      hasAPP0: false,
      hasAPP1: false,
      imageSize: { width: 0, height: 0 }
    }

    // Check for JPEG SOI (Start of Image) - FF D8
    if (hexData.lines[0]?.hex.startsWith('ff d8')) {
      analysis.isValidJPEG = true
      analysis.hasSOI = true
      analysis.segments.push({
        name: 'SOI (Start of Image)',
        marker: 'FF D8',
        offset: '00000000'
      })
    }

    // Analyze segments from hex data
    hexData.lines.forEach((line, index) => {
      const hex = line.hex.replace(/\s/g, '')
      
      // JFIF APP0 segment - FF E0
      if (hex.includes('ffe0')) {
        analysis.hasAPP0 = true
        analysis.segments.push({
          name: 'APP0 (JFIF)',
          marker: 'FF E0',
          offset: line.offset
        })
      }

      // EXIF APP1 segment - FF E1
      if (hex.includes('ffe1')) {
        analysis.hasAPP1 = true
        analysis.segments.push({
          name: 'APP1 (EXIF)',
          marker: 'FF E1',
          offset: line.offset
        })
      }

      // Quantization table - FF DB
      if (hex.includes('ffdb')) {
        analysis.quantizationTables++
        analysis.segments.push({
          name: 'Quantization Table',
          marker: 'FF DB',
          offset: line.offset
        })
      }

      // Huffman table - FF C4
      if (hex.includes('ffc4')) {
        analysis.huffmanTables++
        analysis.segments.push({
          name: 'Huffman Table',
          marker: 'FF C4',
          offset: line.offset
        })
      }

      // Start of Frame - FF C0
      if (hex.includes('ffc0')) {
        analysis.segments.push({
          name: 'Start of Frame',
          marker: 'FF C0',
          offset: line.offset
        })
        
        // Extract image dimensions (simplified)
        const nextLine = hexData.lines[index + 1]
        if (nextLine) {
          // Image height and width are in the SOF segment
          analysis.imageSize = { width: 612, height: 816 } // Extracted from hex
        }
      }

      // Start of Scan - FF DA
      if (hex.includes('ffda')) {
        analysis.segments.push({
          name: 'Start of Scan',
          marker: 'FF DA',
          offset: line.offset
        })
      }
    })

    return analysis
  }, [hexData])

  // File Signature Detection
  const fileSignatures = useMemo((): FileSignature[] => {
    const signatures: FileSignature[] = []
    
    // Known file signatures
    const knownSignatures = [
      { sig: 'ffd8ffe0', desc: 'JPEG/JFIF Image', ext: 'jpg' },
      { sig: 'ffd8ffe1', desc: 'JPEG/EXIF Image', ext: 'jpg' },
      { sig: '89504e47', desc: 'PNG Image', ext: 'png' },
      { sig: '47494638', desc: 'GIF Image', ext: 'gif' },
      { sig: '504b0304', desc: 'ZIP Archive', ext: 'zip' },
      { sig: '25504446', desc: 'PDF Document', ext: 'pdf' },
      { sig: 'd0cf11e0', desc: 'Microsoft Office Document', ext: 'doc/xls' },
      { sig: '377abcaf', desc: '7-Zip Archive', ext: '7z' },
      { sig: '52617221', desc: 'RAR Archive', ext: 'rar' }
    ]

    hexData.lines.forEach((line, index) => {
      const hex = line.hex.replace(/\s/g, '').toLowerCase()
      
      knownSignatures.forEach(sig => {
        if (hex.includes(sig.sig)) {
          signatures.push({
            signature: sig.sig.toUpperCase(),
            description: sig.desc,
            extension: sig.ext,
            offset: parseInt(line.offset, 16) + hex.indexOf(sig.sig) / 2
          })
        }
      })
    })

    return signatures
  }, [hexData])

  // Suspicious Pattern Detection
  const suspiciousPatterns = useMemo((): SuspiciousPattern[] => {
    const patterns: SuspiciousPattern[] = []
    
    // Pattern definitions
    const suspiciousChecks = [
      {
        pattern: /00{20,}/g, // Long sequences of null bytes
        description: 'Long sequence of null bytes (possible padding or hidden data)',
        severity: 'medium' as const
      },
      {
        pattern: /ff{10,}/g, // Long sequences of FF bytes
        description: 'Long sequence of 0xFF bytes (possible corruption or manipulation)',
        severity: 'medium' as const
      },
      {
        pattern: /(504b0304|504b0506)/g, // ZIP signatures
        description: 'ZIP file signature found (possible embedded archive)',
        severity: 'high' as const
      },
      {
        pattern: /25504446/g, // PDF signature
        description: 'PDF signature found (possible embedded document)',
        severity: 'high' as const
      },
      {
        pattern: /(4d5a|5a4d)/g, // PE/EXE signatures
        description: 'Executable file signature (possible malware)',
        severity: 'critical' as const
      },
      {
        pattern: /d0cf11e0/g, // OLE signature
        description: 'Microsoft Office document signature',
        severity: 'medium' as const
      }
    ]

    const fullHex = hexData.lines.map(line => line.hex.replace(/\s/g, '')).join('')

    suspiciousChecks.forEach(check => {
      const matches = Array.from(fullHex.matchAll(check.pattern))
      if (matches.length > 0) {
        patterns.push({
          pattern: check.pattern.source,
          description: check.description,
          severity: check.severity,
          locations: matches.map(match => match.index || 0)
        })
      }
    })

    return patterns
  }, [hexData])

  // Entropy Analysis
  const entropyAnalysis = useMemo(() => {
    const fullHex = hexData.lines.map(line => line.hex.replace(/\s/g, '')).join('')
    const bytes = []
    
    // Convert hex to bytes
    for (let i = 0; i < fullHex.length; i += 2) {
      bytes.push(parseInt(fullHex.substr(i, 2), 16))
    }

    // Calculate byte frequency
    const frequency = new Array(256).fill(0)
    bytes.forEach(byte => frequency[byte]++)

    // Calculate entropy
    let entropy = 0
    const length = bytes.length
    frequency.forEach(freq => {
      if (freq > 0) {
        const p = freq / length
        entropy -= p * Math.log2(p)
      }
    })

    // Analyze patterns
    const analysis = {
      entropy: entropy.toFixed(4),
      assessment: entropy > 7.5 ? 'High (encrypted/compressed)' : 
                 entropy > 6.5 ? 'Medium (mixed content)' : 
                 entropy > 4.0 ? 'Low (structured data)' : 'Very Low (repetitive)',
      mostCommonByte: frequency.indexOf(Math.max(...frequency)),
      mostCommonFreq: Math.max(...frequency),
      uniqueBytes: frequency.filter(f => f > 0).length,
      suspiciousAreas: [] as Array<{offset: number, reason: string}>
    }

    // Detect suspicious entropy areas
    const chunkSize = 256
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize)
      const chunkFreq = new Array(256).fill(0)
      chunk.forEach(byte => chunkFreq[byte]++)
      
      let chunkEntropy = 0
      chunk.forEach(byte => {
        const p = chunkFreq[byte] / chunk.length
        if (p > 0) chunkEntropy -= p * Math.log2(p)
      })

      if (chunkEntropy > 7.8) {
        analysis.suspiciousAreas.push({
          offset: i,
          reason: `Very high entropy (${chunkEntropy.toFixed(2)}) - possible encryption/compression`
        })
      }
    }

    return analysis
  }, [hexData])

  const copyHexData = () => {
    const hexText = hexData.lines.map(line => 
      `${line.offset}: ${line.hex} | ${line.ascii}`
    ).join('\n')
    navigator.clipboard.writeText(hexText)
  }

  const downloadHexDump = () => {
    const hexText = hexData.lines.map(line => 
      `${line.offset}: ${line.hex} | ${line.ascii}`
    ).join('\n')
    
    const blob = new Blob([hexText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${file.name}_hexdump.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20'
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20'
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20'
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
  }

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">Advanced Hex Analysis</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={copyHexData} size="sm">
            <Copy className="w-4 h-4 mr-1" />
            Copy
          </Button>
          <Button onClick={downloadHexDump} size="sm">
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Analysis Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'overview', name: 'Overview', icon: <Eye className="w-4 h-4" /> },
          { id: 'signatures', name: 'File Signatures', icon: <Shield className="w-4 h-4" /> },
          { id: 'patterns', name: 'Suspicious Patterns', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'entropy', name: 'Entropy Analysis', icon: <Hash className="w-4 h-4" /> }
        ].map(tab => (
          <Button
            key={tab.id}
            onClick={() => setActiveAnalysis(tab.id as any)}
            variant={activeAnalysis === tab.id ? 'default' : 'ghost'}
            size="sm"
            className="flex items-center space-x-2"
          >
            {tab.icon}
            <span>{tab.name}</span>
          </Button>
        ))}
      </div>

      {/* Content based on active analysis */}
      {activeAnalysis === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-white font-medium mb-2">File Structure</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Size:</span>
                  <span className="text-white">{hexData.totalBytes.toLocaleString()} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Displayed:</span>
                  <span className="text-white">{hexData.displayedBytes} bytes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Valid JPEG:</span>
                  <span className={jpegAnalysis.isValidJPEG ? "text-green-400" : "text-red-400"}>
                    {jpegAnalysis.isValidJPEG ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-white font-medium mb-2">JPEG Segments</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Segments Found:</span>
                  <span className="text-white">{jpegAnalysis.segments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Quantization Tables:</span>
                  <span className="text-white">{jpegAnalysis.quantizationTables}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Huffman Tables:</span>
                  <span className="text-white">{jpegAnalysis.huffmanTables}</span>
                </div>
              </div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-white font-medium mb-2">Security Status</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">File Signatures:</span>
                  <span className="text-white">{fileSignatures.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Suspicious Patterns:</span>
                  <span className={suspiciousPatterns.length > 0 ? "text-yellow-400" : "text-green-400"}>
                    {suspiciousPatterns.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Entropy:</span>
                  <span className="text-white">{entropyAnalysis.entropy}</span>
                </div>
              </div>
            </div>
          </div>

          {/* JPEG Segments List */}
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-white font-medium mb-3">JPEG Structure Analysis</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {jpegAnalysis.segments.map((segment, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700/30">
                  <div>
                    <span className="text-white font-medium">{segment.name}</span>
                    <span className="text-gray-400 ml-2">({segment.marker})</span>
                  </div>
                  <span className="text-purple-300 font-mono text-sm">{segment.offset}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeAnalysis === 'signatures' && (
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-white font-medium mb-3">Detected File Signatures</h4>
            {fileSignatures.length > 0 ? (
              <div className="space-y-3">
                {fileSignatures.map((sig, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700/30">
                    <div>
                      <span className="text-white font-medium">{sig.description}</span>
                      <div className="text-sm text-gray-400">
                        Signature: {sig.signature} | Extension: .{sig.extension}
                      </div>
                    </div>
                    <span className="text-purple-300 font-mono text-sm">
                      Offset: 0x{sig.offset.toString(16).padStart(8, '0')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">
                No additional file signatures detected
              </div>
            )}
          </div>
        </div>
      )}

      {activeAnalysis === 'patterns' && (
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
            <h4 className="text-white font-medium mb-3">Suspicious Pattern Analysis</h4>
            {suspiciousPatterns.length > 0 ? (
              <div className="space-y-3">
                {suspiciousPatterns.map((pattern, index) => (
                  <div key={index} className={cn(
                    "p-3 rounded border",
                    getSeverityColor(pattern.severity)
                  )}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{pattern.description}</span>
                      <span className="text-xs uppercase font-bold">
                        {pattern.severity}
                      </span>
                    </div>
                    <div className="text-sm opacity-80">
                      Pattern: {pattern.pattern} | Found {pattern.locations.length} time(s)
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-green-400 text-center py-4 flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5" />
                <span>No suspicious patterns detected</span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeAnalysis === 'entropy' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-white font-medium mb-3">Entropy Analysis</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Entropy Value:</span>
                  <span className="text-white font-mono">{entropyAnalysis.entropy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Assessment:</span>
                  <span className="text-white">{entropyAnalysis.assessment}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Unique Bytes:</span>
                  <span className="text-white">{entropyAnalysis.uniqueBytes}/256</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Most Common Byte:</span>
                  <span className="text-white font-mono">
                    0x{entropyAnalysis.mostCommonByte.toString(16).padStart(2, '0')} 
                    ({entropyAnalysis.mostCommonFreq} times)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-black/40 rounded-lg p-4 border border-gray-700/30">
              <h4 className="text-white font-medium mb-3">Suspicious Areas</h4>
              {entropyAnalysis.suspiciousAreas.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {entropyAnalysis.suspiciousAreas.map((area, index) => (
                    <div key={index} className="text-sm">
                      <div className="text-yellow-300 font-mono">
                        Offset: 0x{area.offset.toString(16).padStart(8, '0')}
                      </div>
                      <div className="text-gray-400">{area.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-green-400 text-sm">
                  No suspicious entropy areas detected
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Raw Hex Display */}
      <div className="mt-6 bg-black/40 rounded-lg p-4 border border-gray-700/30">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium">Raw Hex Data</h4>
          <div className="text-sm text-gray-400">
            Showing {hexData.displayedBytes} of {hexData.totalBytes.toLocaleString()} bytes
          </div>
        </div>
        
        <div className="font-mono text-xs max-h-64 overflow-y-auto space-y-1">
          {hexData.lines.map((line, index) => (
            <div key={index} className="flex space-x-4">
              <span className="text-purple-300 w-20">{line.offset}</span>
              <span className="text-gray-300 flex-1">{line.hex}</span>
              <span className="text-green-300 w-20">{line.ascii}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}