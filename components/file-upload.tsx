"use client"

import React, { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from './ui/button'
import { Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  className?: string
}

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      readFile: (filePath: string) => Promise<{ success: boolean; data?: number[]; error?: string }>
      platform: string
    }
  }
}

export function FileUpload({ onFileSelect, className }: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && !!window.electronAPI)
  }, [])

  const handleElectronFileSelect = useCallback(async () => {
    if (!window.electronAPI) return

    try {
      const result = await window.electronAPI.showOpenDialog()
      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0]
        
        // Read file data
        const fileData = await window.electronAPI.readFile(filePath)
        if (fileData.success && fileData.data) {
          // Convert array back to Uint8Array and create File object
          const uint8Array = new Uint8Array(fileData.data)
          const fileName = filePath.split(/[\\/]/).pop() || 'image'
          const mimeType = getMimeType(fileName)
          
          // Create a File object from the data
          const file = new File([uint8Array], fileName, { type: mimeType })
          onFileSelect(file)
        }
      }
    } catch (error) {
      console.error('Error selecting file:', error)
    }
  }, [onFileSelect])

  const getMimeType = (fileName: string): string => {
    const ext = fileName.toLowerCase().split('.').pop()
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'tiff': 'image/tiff',
      'tif': 'image/tiff',
      'webp': 'image/webp'
    }
    return mimeTypes[ext || ''] || 'image/jpeg'
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0])
    }
    setDragActive(false)
  }, [onFileSelect])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.tiff', '.tif', '.webp', '.bmp', '.gif']
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    noClick: true // Disable default click behavior
  })

  const handleButtonClick = useCallback(() => {
    if (isElectron) {
      handleElectronFileSelect()
    } else {
      open() // Open file dialog
    }
  }, [isElectron, handleElectronFileSelect, open])

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-300",
          "border-purple-400/30 hover:border-purple-400/50 bg-black/20 backdrop-blur-sm",
          isDragActive && "border-purple-400/70 bg-purple-400/10",
          dragActive && "scale-105"
        )}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          {/* Logo without background circle */}
          <div className="mx-auto w-20 h-20 flex items-center justify-center">
            <img 
              src={isElectron ? "./icon.png" : "/icon.png"} 
              alt="EXIF Viewer Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-white">
              {isDragActive ? 'Drop your image here' : 'Upload Image for EXIF Analysis'}
            </h3>
            <p className="text-gray-400 text-sm">
              Drag & drop an image file or click to browse
            </p>
            <p className="text-gray-500 text-xs">
              Supports: JPEG, PNG, TIFF, WebP, BMP, GIF
            </p>
          </div>
          
          <div className="pt-4">
            {/* Simple button without extra wrapper */}
            <button 
              onClick={handleButtonClick}
              className="relative inline-block overflow-hidden rounded-full p-[1.5px]"
            >
              <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]"></span>
              <div className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-white dark:bg-gray-950 text-xs font-medium backdrop-blur-3xl">
                <span className="inline-flex rounded-full text-center group items-center w-full justify-center transition-all font-medium cursor-pointer bg-gradient-to-tr from-zinc-300/20 via-purple-400/30 to-transparent dark:from-zinc-300/5 dark:via-purple-400/20 text-gray-900 dark:text-white border-input border-[1px] hover:bg-gradient-to-tr hover:from-zinc-300/30 hover:via-purple-400/40 hover:to-transparent dark:hover:from-zinc-300/10 dark:hover:via-purple-400/30 py-5 px-12 text-base sm:text-lg">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose File
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}