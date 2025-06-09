import { useState, useCallback } from 'react';

export interface ExifWorkerResult {
  success: boolean;
  data?: any;
  error?: string;
}

export function useExifWorker() {
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(async (file: File): Promise<ExifWorkerResult> => {
    setIsProcessing(true);
    
    try {
      // Simulate EXIF processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = {
        success: true,
        data: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          lastModified: new Date(file.lastModified).toISOString()
        }
      };
      
      setIsProcessing(false);
      return result;
    } catch (error) {
      setIsProcessing(false);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  const processFiles = useCallback(async (files: File[]): Promise<ExifWorkerResult[]> => {
    setIsProcessing(true);
    
    try {
      const results = await Promise.all(files.map(file => processFile(file)));
      setIsProcessing(false);
      return results;
    } catch (error) {
      setIsProcessing(false);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }, [processFile]);

  return {
    processFile,
    processFiles,
    isProcessing
  };
}