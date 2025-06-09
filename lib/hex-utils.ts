export interface HexRow {
  offset: string;
  hex: string;
  ascii: string;
}

export function generateHexDump(buffer: ArrayBuffer): HexRow[] {
  const bytes = new Uint8Array(buffer);
  const rows: HexRow[] = [];
  
  for (let i = 0; i < bytes.length; i += 16) {
    const offset = i.toString(16).padStart(8, '0').toUpperCase();
    const chunk = bytes.slice(i, i + 16);
    
    const hex = Array.from(chunk)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    
    const ascii = Array.from(chunk)
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
      .join('');
    
    rows.push({ offset, hex, ascii });
  }
  
  return rows;
}

export function detectFileSignatures(buffer: ArrayBuffer): string[] {
  const signatures: string[] = [];
  const bytes = new Uint8Array(buffer);
  
  // Common file signatures
  const fileSignatures = [
    { signature: [0xFF, 0xD8, 0xFF], type: 'JPEG' },
    { signature: [0x89, 0x50, 0x4E, 0x47], type: 'PNG' },
    { signature: [0x47, 0x49, 0x46], type: 'GIF' },
    { signature: [0x42, 0x4D], type: 'BMP' },
    { signature: [0x49, 0x49, 0x2A, 0x00], type: 'TIFF (Little Endian)' },
    { signature: [0x4D, 0x4D, 0x00, 0x2A], type: 'TIFF (Big Endian)' }
  ];
  
  for (const { signature, type } of fileSignatures) {
    if (bytes.length >= signature.length) {
      const matches = signature.every((byte, index) => bytes[index] === byte);
      if (matches) {
        signatures.push(type);
      }
    }
  }
  
  return signatures;
}

export function calculateEntropy(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  const frequency = new Array(256).fill(0);
  
  for (const byte of bytes) {
    frequency[byte]++;
  }
  
  let entropy = 0;
  const length = bytes.length;
  
  for (const freq of frequency) {
    if (freq > 0) {
      const probability = freq / length;
      entropy -= probability * Math.log2(probability);
    }
  }
  
  return entropy;
}