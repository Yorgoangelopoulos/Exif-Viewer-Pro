"use client"

import React, { useState, useCallback } from 'react'
import { Button } from './ui/button'
import { 
  Edit3, 
  Trash2, 
  Save, 
  Download, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  X,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExifEditorProps {
  file: File
  exifData: { [key: string]: any }
  onExifUpdate?: (newExifData: { [key: string]: any }) => void
}

interface EditableField {
  key: string
  value: any
  originalValue: any
  isEditing: boolean
  isNew?: boolean
}

export function ExifEditor({ file, exifData, onExifUpdate }: ExifEditorProps) {
  const [editableFields, setEditableFields] = useState<{ [key: string]: EditableField }>({})
  const [showEditor, setShowEditor] = useState(false)
  const [newFieldKey, setNewFieldKey] = useState('')
  const [newFieldValue, setNewFieldValue] = useState('')
  const [showAddField, setShowAddField] = useState(false)

  const sensitiveFields = [
    'GPS', 'latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude',
    'GPSImgDirection', 'GPSSpeed', 'GPSAreaInformation', 'GPSDateStamp', 'GPSTimeStamp',
    'Make', 'Model', 'Software', 'DateTime', 'DateTimeOriginal', 'DateTimeDigitized',
    'Artist', 'Copyright', 'UserComment', 'ImageDescription', 'XPComment', 'XPAuthor',
    'XPKeywords', 'XPSubject', 'XPTitle', 'CameraOwnerName', 'BodySerialNumber',
    'LensSerialNumber', 'OwnerName'
  ]

  const initializeEditableFields = useCallback(() => {
    const fields: { [key: string]: EditableField } = {}
    Object.entries(exifData).forEach(([key, value]) => {
      fields[key] = {
        key,
        value,
        originalValue: value,
        isEditing: false
      }
    })
    setEditableFields(fields)
  }, [exifData])

  const startEditing = (key: string) => {
    setEditableFields(prev => ({
      ...prev,
      [key]: { ...prev[key], isEditing: true }
    }))
  }

  const cancelEditing = (key: string) => {
    setEditableFields(prev => ({
      ...prev,
      [key]: { 
        ...prev[key], 
        isEditing: false, 
        value: prev[key].originalValue 
      }
    }))
  }

  const saveField = (key: string) => {
    setEditableFields(prev => ({
      ...prev,
      [key]: { 
        ...prev[key], 
        isEditing: false, 
        originalValue: prev[key].value 
      }
    }))
  }

  const updateFieldValue = (key: string, newValue: any) => {
    setEditableFields(prev => ({
      ...prev,
      [key]: { ...prev[key], value: newValue }
    }))
  }

  const deleteField = (key: string) => {
    setEditableFields(prev => {
      const newFields = { ...prev }
      delete newFields[key]
      return newFields
    })
  }

  const addNewField = () => {
    if (newFieldKey && newFieldValue) {
      setEditableFields(prev => ({
        ...prev,
        [newFieldKey]: {
          key: newFieldKey,
          value: newFieldValue,
          originalValue: newFieldValue,
          isEditing: false,
          isNew: true
        }
      }))
      setNewFieldKey('')
      setNewFieldValue('')
      setShowAddField(false)
    }
  }

  const removeSensitiveData = () => {
    const cleanedFields: { [key: string]: EditableField } = {}
    Object.entries(editableFields).forEach(([key, field]) => {
      const isSensitive = sensitiveFields.some(sensitive => 
        key.toLowerCase().includes(sensitive.toLowerCase())
      )
      if (!isSensitive) {
        cleanedFields[key] = field
      }
    })
    setEditableFields(cleanedFields)
  }

  const exportCleanedImage = useCallback(async () => {
    try {
      // Create a canvas to redraw the image without EXIF data
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      return new Promise((resolve, reject) => {
        img.onload = () => {
          canvas.width = img.width
          canvas.height = img.height
          ctx?.drawImage(img, 0, 0)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `cleaned_${file.name}`
              link.click()
              URL.revokeObjectURL(url)
              resolve(blob)
            } else {
              reject(new Error('Failed to create cleaned image'))
            }
          }, file.type, 0.95)
        }
        
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = URL.createObjectURL(file)
      })
    } catch (error) {
      console.error('Error exporting cleaned image:', error)
    }
  }, [file])

  const exportModifiedExif = () => {
    const modifiedData: { [key: string]: any } = {}
    Object.values(editableFields).forEach(field => {
      modifiedData[field.key] = field.value
    })
    
    const dataStr = JSON.stringify(modifiedData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `modified_${file.name}_exif.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!showEditor) {
    return (
      <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-purple-300" />
            <h3 className="text-lg font-semibold text-white">EXIF Editor</h3>
          </div>
          <Button onClick={() => {
            initializeEditableFields()
            setShowEditor(true)
          }}>
            <Edit3 className="w-4 h-4 mr-2" />
            Edit Metadata
          </Button>
        </div>
        
        <div className="space-y-4">
          <div className="bg-black/20 border border-purple-400/20 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-300" />
              <span className="text-yellow-300 font-medium">Privacy Warning</span>
            </div>
            <p className="text-yellow-200 text-sm">
              This image contains {Object.keys(exifData).length} metadata fields. 
              Some may include sensitive information like GPS location, camera serial numbers, or timestamps.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={removeSensitiveData} className="w-full">
              <Shield className="w-4 h-4 mr-2" />
              Remove Sensitive Data
            </Button>
            <Button onClick={exportCleanedImage} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Clean Image
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-black/20 backdrop-blur-sm rounded-lg border border-purple-400/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Edit3 className="w-5 h-5 text-purple-300" />
          <h3 className="text-lg font-semibold text-white">EXIF Editor</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setShowAddField(true)} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Field
          </Button>
          <Button onClick={exportModifiedExif} size="sm">
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button onClick={() => setShowEditor(false)} variant="outline" size="sm">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Add New Field */}
      {showAddField && (
        <div className="bg-black/40 rounded-lg p-4 mb-4 border border-gray-700/30">
          <h4 className="text-white font-medium mb-3">Add New Field</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Field name"
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              className="px-3 py-2 bg-black/40 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Field value"
              value={newFieldValue}
              onChange={(e) => setNewFieldValue(e.target.value)}
              className="px-3 py-2 bg-black/40 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
            />
            <div className="flex space-x-2">
              <Button onClick={addNewField} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
              <Button onClick={() => setShowAddField(false)} variant="outline" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <Button onClick={removeSensitiveData} className="w-full">
          <Shield className="w-4 h-4 mr-2" />
          Remove Sensitive Data
        </Button>
        <Button onClick={exportCleanedImage} className="w-full">
          <Download className="w-4 h-4 mr-2" />
          Download Clean Image
        </Button>
        <Button onClick={exportModifiedExif} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* Editable Fields */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {Object.values(editableFields).map((field) => {
          const isSensitive = sensitiveFields.some(sensitive => 
            field.key.toLowerCase().includes(sensitive.toLowerCase())
          )
          
          return (
            <div 
              key={field.key} 
              className={cn(
                "flex items-center justify-between py-3 px-4 rounded-lg border",
                isSensitive ? "bg-red-400/10 border-red-400/20" : "bg-black/40 border-gray-700/30",
                field.isNew && "bg-green-400/10 border-green-400/20"
              )}
            >
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center space-x-2">
                  <span className={cn(
                    "font-medium",
                    isSensitive ? "text-red-300" : "text-gray-300"
                  )}>
                    {field.key}
                  </span>
                  {isSensitive && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  {field.isNew && <CheckCircle className="w-3 h-3 text-green-400" />}
                </div>
                
                <div className="flex items-center space-x-2">
                  {field.isEditing ? (
                    <input
                      type="text"
                      value={String(field.value)}
                      onChange={(e) => updateFieldValue(field.key, e.target.value)}
                      className="flex-1 px-2 py-1 bg-black/40 border border-gray-600 rounded text-white text-sm focus:border-purple-400 focus:outline-none"
                    />
                  ) : (
                    <span className="text-white text-sm flex-1">
                      {String(field.value)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-1 ml-3">
                {field.isEditing ? (
                  <>
                    <button
                      onClick={() => saveField(field.key)}
                      className="p-1 text-green-400 hover:text-green-300 transition-colors"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => cancelEditing(field.key)}
                      className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(field.key)}
                      className="p-1 text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteField(field.key)}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}