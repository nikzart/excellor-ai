import { v4 as uuidv4 } from 'uuid';

// Only import these on client side to prevent SSR issues

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    chunkIndex: number;
    type: 'pdf' | 'docx' | 'txt';
  };
  embedding?: number[];
}

export interface ProcessedDocument {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'txt';
  chunks: DocumentChunk[];
  totalPages?: number;
  createdAt: Date;
}

/**
 * Extract text from PDF file
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing only available in browser environment');
  }

  try {
    // Dynamic import to prevent SSR issues
    const pdfjs = await import('pdfjs-dist');

    // Configure worker - use local worker first, then fallback to CDN
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      // Try local worker first
      const localWorkerSrc = '/js/pdf.worker.min.js';

      try {
        // Test if local worker is available
        const response = await fetch(localWorkerSrc, { method: 'HEAD' });
        if (response.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = localWorkerSrc;
          console.log('PDF.js worker configured with local worker:', localWorkerSrc);
        } else {
          throw new Error('Local worker not available');
        }
      } catch {
        // Fallback to CDN
        const cdnWorkerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        pdfjs.GlobalWorkerOptions.workerSrc = cdnWorkerSrc;
        console.log('PDF.js worker configured with CDN worker:', cdnWorkerSrc);
      }
    }

    const arrayBuffer = await file.arrayBuffer();

    console.log('Processing PDF file:', file.name, 'Size:', file.size, 'bytes');

    const pdf = await pdfjs.getDocument({
      data: arrayBuffer,
      verbosity: 0,
      useSystemFonts: true,
      disableAutoFetch: false,
      disableStream: false
    }).promise;

    console.log('PDF loaded successfully, pages:', pdf.numPages);

    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        let pageText = '';
        for (const item of textContent.items) {
          if ('str' in item) {
            pageText += item.str + ' ';
          }
        }

        pageText = pageText.replace(/\s+/g, ' ').trim();

        if (pageText) {
          fullText += `\n[Page ${i}]\n${pageText}\n`;
          console.log(`Extracted ${pageText.length} characters from page ${i}`);
        }
      } catch (pageError) {
        console.warn(`Failed to extract text from page ${i}:`, pageError);
        fullText += `\n[Page ${i}]\n[Error extracting text from this page]\n`;
      }
    }

    if (!fullText.trim()) {
      throw new Error('No text content found in PDF. This might be a scanned document or image-based PDF.');
    }

    console.log('PDF processing completed successfully, total text length:', fullText.length);
    return fullText;

  } catch (error) {
    console.error('PDF processing error:', error);

    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('worker')) {
        throw new Error('PDF worker failed to load. Please check your internet connection and try again, or try a different PDF file.');
      } else if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid PDF file. Please ensure the file is not corrupted.');
      } else if (error.message.includes('fetch')) {
        throw new Error('Network error while processing PDF. Please check your connection and try again.');
      } else {
        throw new Error(`PDF processing failed: ${error.message}`);
      }
    } else {
      throw new Error('Unknown error occurred while processing PDF. Please try again.');
    }
  }
}

/**
 * Extract text from DOCX file
 */
export async function extractTextFromDOCX(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('DOCX processing only available in browser environment');
  }

  // Dynamic import to prevent SSR issues
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Extract text from TXT file
 */
export async function extractTextFromTXT(file: File): Promise<string> {
  return await file.text();
}

/**
 * Split text into chunks for better processing
 */
export function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const proposedChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;

    if (proposedChunk.length <= maxChunkSize) {
      currentChunk = proposedChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk + '.');

        // Add overlap from the end of current chunk
        const words = currentChunk.split(' ');
        const overlapWords = words.slice(-Math.min(overlap / 5, words.length / 2));
        currentChunk = overlapWords.join(' ') + (overlapWords.length > 0 ? '. ' : '') + trimmedSentence;
      } else {
        // Handle very long sentences
        currentChunk = trimmedSentence;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk + '.');
  }

  return chunks.filter(chunk => chunk.trim().length > 10); // Filter out very short chunks
}

/**
 * Process a document file and return structured chunks
 */
export async function processDocument(file: File): Promise<ProcessedDocument> {
  const fileType = getFileType(file);
  let extractedText: string;

  try {
    switch (fileType) {
      case 'pdf':
        extractedText = await extractTextFromPDF(file);
        break;
      case 'docx':
        extractedText = await extractTextFromDOCX(file);
        break;
      case 'txt':
        extractedText = await extractTextFromTXT(file);
        break;
      default:
        throw new Error(`Unsupported file type: ${file.type}`);
    }

    const textChunks = chunkText(extractedText);
    const documentId = uuidv4();

    const chunks: DocumentChunk[] = textChunks.map((chunk, index) => ({
      id: uuidv4(),
      content: chunk,
      metadata: {
        source: file.name,
        chunkIndex: index,
        type: fileType
      }
    }));

    return {
      id: documentId,
      name: file.name,
      type: fileType,
      chunks,
      createdAt: new Date()
    };

  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get file type from file
 */
function getFileType(file: File): 'pdf' | 'docx' | 'txt' {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (file.type === 'text/plain') return 'txt';

  // Fallback to extension
  const extension = file.name.toLowerCase().split('.').pop();
  switch (extension) {
    case 'pdf': return 'pdf';
    case 'docx': return 'docx';
    case 'txt': return 'txt';
    default: throw new Error(`Unsupported file type: ${file.type}`);
  }
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const supportedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  const extension = file.name.toLowerCase().split('.').pop();
  const isValidType = supportedTypes.includes(file.type) ||
                     ['pdf', 'docx', 'txt'].includes(extension || '');

  if (!isValidType) {
    return { valid: false, error: 'Supported formats: PDF, DOCX, TXT' };
  }

  return { valid: true };
}