'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, File, X, AlertCircle, Loader, Trash2, FileText } from 'lucide-react';
import { processDocument, validateFile, ProcessedDocument } from '@/lib/documentProcessor';
import { storeDocument, getAllDocuments, deleteDocument, getStorageStats } from '@/lib/vectorDatabase';

interface DocumentUploadProps {
  onDocumentsChange?: (documents: ProcessedDocument[]) => void;
  className?: string;
}

interface UploadState {
  uploading: boolean;
  processing: boolean;
  progress: string;
  error: string | null;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onDocumentsChange, className = '' }) => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    processing: false,
    progress: '',
    error: null
  });
  const [storageStats, setStorageStats] = useState({ documentCount: 0, chunkCount: 0, totalSize: '0KB' });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents on component mount
  React.useEffect(() => {
    loadDocuments();
    loadStorageStats();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs);
      onDocumentsChange?.(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const loadStorageStats = async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Error loading storage stats:', error);
    }
  };

  const handleFileUpload = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await processFile(file);
    }
  }, []);

  const processFile = async (file: File) => {
    setUploadState({
      uploading: true,
      processing: false,
      progress: `Validating ${file.name}...`,
      error: null
    });

    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      setUploadState(prev => ({
        ...prev,
        processing: true,
        progress: `Processing ${file.name}...`
      }));

      // Process document
      const processedDoc = await processDocument(file);

      setUploadState(prev => ({
        ...prev,
        progress: `Generating embeddings for ${processedDoc.chunks.length} chunks...`
      }));

      // Store document with embeddings
      await storeDocument(processedDoc);

      setUploadState(prev => ({
        ...prev,
        progress: `Successfully processed ${file.name}`
      }));

      // Reload documents and stats
      await loadDocuments();
      await loadStorageStats();

      // Clear success message after delay
      setTimeout(() => {
        setUploadState(prev => ({
          ...prev,
          uploading: false,
          processing: false,
          progress: '',
          error: null
        }));
      }, 2000);

    } catch (error) {
      console.error('Error processing file:', error);
      setUploadState({
        uploading: false,
        processing: false,
        progress: '',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      await loadDocuments();
      await loadStorageStats();
    } catch (error) {
      console.error('Error deleting document:', error);
      setUploadState(prev => ({
        ...prev,
        error: 'Failed to delete document'
      }));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'docx':
        return '📝';
      case 'txt':
        return '📋';
      default:
        return '📄';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer
          ${dragOver ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
          ${uploadState.uploading ? 'pointer-events-none opacity-50' : 'hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          onChange={handleFileInputChange}
          className="hidden"
        />

        <div className="text-center">
          {uploadState.uploading ? (
            <div className="space-y-3">
              <Loader className="w-8 h-8 mx-auto animate-spin text-blue-600" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{uploadState.progress}</p>
              {uploadState.processing && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upload documents for RAG
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  PDF, DOCX, TXT files up to 10MB
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Drop files here or click to browse
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {uploadState.error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-400">{uploadState.error}</span>
          <button
            onClick={() => setUploadState(prev => ({ ...prev, error: null }))}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Storage Stats */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
        <div className="flex items-center space-x-4">
          <span>📊 {storageStats.documentCount} documents</span>
          <span>🔗 {storageStats.chunkCount} chunks</span>
          <span>💾 {storageStats.totalSize}</span>
        </div>
        <div className="flex items-center space-x-1">
          <FileText className="w-3 h-3" />
          <span>Client-side RAG</span>
        </div>
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Uploaded Documents ({documents.length})
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg group"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-lg">{getFileIcon(doc.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {doc.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {doc.chunks.length} chunks • {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDocument(doc.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                  title="Delete document"
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
        <p>💡 <strong>Tip:</strong> Upload your UPSC study materials, current affairs documents, or reference books.</p>
        <p>🔍 Once uploaded, I can search and reference these documents in my responses.</p>
        <p>🚀 <strong>Powered by Azure OpenAI:</strong> Using text-embedding-3-large for high-quality embeddings.</p>
        <p>🔒 Documents are processed locally - only embeddings are generated via secure API.</p>
      </div>
    </div>
  );
};

export default DocumentUpload;