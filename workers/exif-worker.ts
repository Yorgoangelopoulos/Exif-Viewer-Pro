// Web Worker for EXIF processing
import * as EXIF from 'exifr'

interface WorkerMessage {
  type: 'PROCESS_EXIF' | 'BATCH_PROCESS' | 'HEX_ANALYSIS'
  payload: any
}

interface WorkerResponse {
  type: 'EXIF_RESULT' | 'BATCH_RESULT' | 'HEX_RESULT' | 'ERROR' | 'PROGRESS'
  payload: any
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data

  try {
    switch (type) {
      case 'PROCESS_EXIF':
        await processExif(payload)
        break
      
      case 'BATCH_PROCESS':
        await batchProcess(payload)
        break
      
      case 'HEX_ANALYSIS':
        await hexAnalysis(payload)
        break
      
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
  } catch (error) {
    const response: WorkerResponse = {
      type: 'ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
    self.postMessage(response)
  }
}

async function processExif(payload: { fileBuffer: ArrayBuffer, fileName: string }) {
  const { fileBuffer, fileName } = payload
  
  // Process EXIF data
  const exifData = await EXIF.parse(fileBuffer, {
    gps: true,
    tiff: true,
    exif: true,
    jfif: true,
    ihdr: true,
    iptc: true,
    icc: true,
    xmp: true
  })

  // Enhanced processing
  const enhancedData = {
    ...exifData,
    // Add computed fields
    focalLength35mm: calculateFocalLength35mm(exifData),
    hyperfocalDistance: calculateHyperfocalDistance(exifData),
    depthOfField: calculateDepthOfField(exifData),
    exposureValue: calculateExposureValue(exifData),
    lightValue: calculateLightValue(exifData)
  }

  const response: WorkerResponse = {
    type: 'EXIF_RESULT',
    payload: {
      fileName,
      exifData: enhancedData,
      processingTime: Date.now()
    }
  }
  
  self.postMessage(response)
}

async function batchProcess(payload: { files: Array<{ buffer: ArrayBuffer, name: string }> }) {
  const { files } = payload
  const results = []
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    
    // Send progress update
    const progressResponse: WorkerResponse = {
      type: 'PROGRESS',
      payload: {
        current: i + 1,
        total: files.length,
        fileName: file.name
      }
    }
    self.postMessage(progressResponse)
    
    try {
      const exifData = await EXIF.parse(file.buffer, {
        gps: true,
        tiff: true,
        exif: true,
        jfif: true,
        ihdr: true
      })
      
      results.push({
        fileName: file.name,
        exifData,
        status: 'success'
      })
    } catch (error) {
      results.push({
        fileName: file.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      })
    }
  }
  
  const response: WorkerResponse = {
    type: 'BATCH_RESULT',
    payload: {
      results,
      summary: generateBatchSummary(results)
    }
  }
  
  self.postMessage(response)
}

async function hexAnalysis(payload: { fileBuffer: ArrayBuffer, fileName: string }) {
  const { fileBuffer, fileName } = payload
  const uint8Array = new Uint8Array(fileBuffer)
  
  // File signature analysis
  const signature = analyzeFileSignature(uint8Array)
  
  // Entropy calculation
  const entropy = calculateEntropy(uint8Array)
  
  // Embedded file detection
  const embeddedFiles = detectEmbeddedFiles(uint8Array)
  
  // Generate hex dump (first 2KB)
  const hexDump = generateHexDump(uint8Array.slice(0, 2048))
  
  const response: WorkerResponse = {
    type: 'HEX_RESULT',
    payload: {
      fileName,
      signature,
      entropy,
      embeddedFiles,
      hexDump,
      fileSize: uint8Array.length
    }
  }
  
  self.postMessage(response)
}

// Helper functions
function calculateFocalLength35mm(exifData: any): number | null {
  if (!exifData.FocalLength) return null
  
  const cropFactor = getCropFactor(exifData.Make, exifData.Model)
  return Math.round(exifData.FocalLength * cropFactor)
}

function calculateHyperfocalDistance(exifData: any): number | null {
  if (!exifData.FocalLength || !exifData.FNumber) return null
  
  const focalLength = exifData.FocalLength
  const aperture = exifData.FNumber
  const circleOfConfusion = 0.03 // mm for full frame
  
  return Math.round((focalLength * focalLength) / (aperture * circleOfConfusion))
}

function calculateDepthOfField(exifData: any): { near: number, far: number } | null {
  // Simplified DOF calculation
  if (!exifData.FocalLength || !exifData.FNumber) return null
  
  return {
    near: 1.5, // meters (simplified)
    far: 10.0  // meters (simplified)
  }
}

function calculateExposureValue(exifData: any): number | null {
  if (!exifData.FNumber || !exifData.ExposureTime) return null
  
  const aperture = exifData.FNumber
  const shutterSpeed = exifData.ExposureTime
  
  return Math.round(Math.log2(aperture * aperture / shutterSpeed))
}

function calculateLightValue(exifData: any): number | null {
  if (!exifData.ISO || !exifData.FNumber || !exifData.ExposureTime) return null
  
  const iso = exifData.ISO
  const aperture = exifData.FNumber
  const shutterSpeed = exifData.ExposureTime
  
  return Math.round(Math.log2(aperture * aperture / shutterSpeed) + Math.log2(iso / 100))
}

function getCropFactor(make?: string, model?: string): number {
  // Simplified crop factor lookup
  if (!make) return 1.0
  
  const makeUpper = make.toUpperCase()
  if (makeUpper.includes('CANON')) {
    if (model?.includes('5D') || model?.includes('6D') || model?.includes('1D')) return 1.0
    return 1.6 // APS-C
  }
  if (makeUpper.includes('NIKON')) {
    if (model?.includes('D850') || model?.includes('D780') || model?.includes('Z')) return 1.0
    return 1.5 // APS-C
  }
  if (makeUpper.includes('SONY')) {
    if (model?.includes('A7') || model?.includes('A9')) return 1.0
    return 1.5 // APS-C
  }
  
  return 1.0 // Default to full frame
}

function generateBatchSummary(results: any[]) {
  const summary = {
    totalFiles: results.length,
    successful: results.filter(r => r.status === 'success').length,
    errors: results.filter(r => r.status === 'error').length,
    withGPS: 0,
    cameras: {} as { [key: string]: number },
    dateRange: { earliest: null as string | null, latest: null as string | null }
  }
  
  results.forEach(result => {
    if (result.status === 'success' && result.exifData) {
      // GPS count
      if (result.exifData.latitude && result.exifData.longitude) {
        summary.withGPS++
      }
      
      // Camera count
      const camera = result.exifData.Make && result.exifData.Model 
        ? `${result.exifData.Make} ${result.exifData.Model}`
        : 'Unknown'
      summary.cameras[camera] = (summary.cameras[camera] || 0) + 1
      
      // Date range
      const dateStr = result.exifData.DateTimeOriginal || result.exifData.DateTime
      if (dateStr) {
        if (!summary.dateRange.earliest || dateStr < summary.dateRange.earliest) {
          summary.dateRange.earliest = dateStr
        }
        if (!summary.dateRange.latest || dateStr > summary.dateRange.latest) {
          summary.dateRange.latest = dateStr
        }
      }
    }
  })
  
  return summary
}

function analyzeFileSignature(data: Uint8Array) {
  const signature = Array.from(data.slice(0, 16))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // Known signatures
  if (signature.startsWith('ffd8ffe0')) return { type: 'JPEG (JFIF)', confidence: 100 }
  if (signature.startsWith('ffd8ffe1')) return { type: 'JPEG (EXIF)', confidence: 100 }
  if (signature.startsWith('89504e47')) return { type: 'PNG', confidence: 100 }
  if (signature.startsWith('47494638')) return { type: 'GIF', confidence: 100 }
  
  return { type: 'Unknown', confidence: 0 }
}

function calculateEntropy(data: Uint8Array): number {
  const frequency = new Array(256).fill(0)
  for (const byte of data) {
    frequency[byte]++
  }
  
  let entropy = 0
  const length = data.length
  for (const freq of frequency) {
    if (freq > 0) {
      const p = freq / length
      entropy -= p * Math.log2(p)
    }
  }
  
  return entropy
}

function detectEmbeddedFiles(data: Uint8Array): Array<{ type: string, offset: number }> {
  const embedded: Array<{ type: string, offset: number }> = []
  const signatures = [
    { sig: 'ffd8ffe0', type: 'JPEG' },
    { sig: '89504e47', type: 'PNG' },
    { sig: '504b0304', type: 'ZIP' },
    { sig: '25504446', type: 'PDF' }
  ]
  
  const hexString = Array.from(data.slice(0, Math.min(data.length, 10000)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  signatures.forEach(sigData => {
    let index = hexString.indexOf(sigData.sig)
    while (index !== -1 && index > 0) { // Skip file header
      embedded.push({
        type: sigData.type,
        offset: index / 2
      })
      index = hexString.indexOf(sigData.sig, index + 1)
    }
  })
  
  return embedded
}

function generateHexDump(data: Uint8Array) {
  const lines = []
  
  for (let i = 0; i < data.length; i += 16) {
    const offset = i.toString(16).padStart(8, '0').toUpperCase()
    const chunk = data.slice(i, i + 16)
    
    const hex = Array.from(chunk)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(47, ' ')
    
    const ascii = Array.from(chunk)
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
      .join('')
    
    lines.push({ offset, hex, ascii })
  }
  
  return lines
}

export {}