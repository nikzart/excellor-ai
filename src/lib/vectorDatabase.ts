import { DocumentChunk, ProcessedDocument } from './documentProcessor';

// Re-export DocumentChunk for convenience
export type { DocumentChunk } from './documentProcessor';

// Type import for LocalForage (available at runtime)
type LocalForage = {
  setItem: (key: string, value: unknown) => Promise<unknown>;
  getItem: <T>(key: string) => Promise<T | null>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
  iterate: (callback: (value: unknown, key: string) => void) => Promise<void>;
};

// Initialize databases only in browser
let documentsDB: LocalForage | null = null;
let embeddingsDB: LocalForage | null = null;

async function initializeDatabases() {
  if (typeof window === 'undefined') {
    throw new Error('Database operations only available in browser environment');
  }

  if (!documentsDB || !embeddingsDB) {
    const localForage = (await import('localforage')).default;

    documentsDB = localForage.createInstance({
      name: 'excellor-documents',
      version: 1.0,
      description: 'Document storage for EXCELLOR AI RAG'
    });

    embeddingsDB = localForage.createInstance({
      name: 'excellor-embeddings',
      version: 1.0,
      description: 'Embeddings storage for EXCELLOR AI RAG'
    });
  }

  return { documentsDB, embeddingsDB };
}

// Azure OpenAI Configuration
const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT || 'https://xandar-resource.cognitiveservices.azure.com/openai/deployments/text-embedding-3-large/embeddings?api-version=2023-05-15';
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;

// text-embedding-3-large has 3072 dimensions
const EMBEDDING_DIMENSIONS = 3072;

/**
 * Generate embeddings for text using Azure OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!AZURE_OPENAI_API_KEY) {
      console.warn('Azure OpenAI API key not configured, using fallback');
      return generateSimpleVector(text);
    }

    console.log('Generating embedding for text:', text.substring(0, 100) + '...');

    const response = await fetch(AZURE_OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        input: text
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response format from Azure OpenAI API');
    }

    const embedding = data.data[0].embedding;

    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Invalid embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${embedding.length}`);
    }

    console.log('Azure embedding generated successfully, dimensions:', embedding.length);
    return embedding;

  } catch (error) {
    console.error('Error generating Azure embedding:', error);

    // Fallback to simple vector generation
    console.log('Falling back to simple vector generation');
    return generateSimpleVector(text);
  }
}

/**
 * Fallback simple vector generation based on text characteristics
 */
function generateSimpleVector(text: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0); // Match Azure embedding dimensions
  const words = text.toLowerCase().split(/\s+/);

  // Simple hash-based features
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const hash = simpleHash(word);
    vector[hash % EMBEDDING_DIMENSIONS] += 1;
  }

  // Add character-level features for better differentiation
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    vector[(charCode * 17) % EMBEDDING_DIMENSIONS] += 0.1;
  }

  // Normalize
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Store document with embeddings
 */
export async function storeDocument(document: ProcessedDocument): Promise<void> {
  try {
    const { documentsDB, embeddingsDB } = await initializeDatabases();
    console.log(`Processing document: ${document.name}`);

    // Generate embeddings for all chunks
    const chunksWithEmbeddings = await Promise.all(
      document.chunks.map(async (chunk, index) => {
        console.log(`Generating embedding for chunk ${index + 1}/${document.chunks.length}`);
        const embedding = await generateEmbedding(chunk.content);
        return { ...chunk, embedding };
      })
    );

    const documentWithEmbeddings = {
      ...document,
      chunks: chunksWithEmbeddings
    };

    // Store document
    await documentsDB.setItem(document.id, documentWithEmbeddings);

    // Store individual chunk embeddings for faster retrieval
    for (const chunk of chunksWithEmbeddings) {
      await embeddingsDB.setItem(chunk.id, {
        documentId: document.id,
        embedding: chunk.embedding,
        content: chunk.content,
        metadata: chunk.metadata
      });
    }

    console.log(`Document ${document.name} stored successfully with ${chunksWithEmbeddings.length} chunks`);
  } catch (error) {
    console.error('Error storing document:', error);
    throw new Error(`Failed to store document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all stored documents
 */
export async function getAllDocuments(): Promise<ProcessedDocument[]> {
  try {
    const { documentsDB } = await initializeDatabases();
    const documents: ProcessedDocument[] = [];
    await documentsDB.iterate((value: unknown) => {
      documents.push(value as ProcessedDocument);
    });
    return documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('Error getting documents:', error);
    return [];
  }
}

/**
 * Delete a document and its embeddings
 */
export async function deleteDocument(documentId: string): Promise<void> {
  try {
    const { documentsDB, embeddingsDB } = await initializeDatabases();
    const document = await documentsDB.getItem<ProcessedDocument>(documentId);
    if (document) {
      // Delete chunk embeddings
      for (const chunk of document.chunks) {
        await embeddingsDB.removeItem(chunk.id);
      }
      // Delete document
      await documentsDB.removeItem(documentId);
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    throw new Error('Failed to delete document');
  }
}

/**
 * Search for relevant chunks using similarity search
 */
export async function searchSimilarChunks(
  query: string,
  topK: number = 3,
  threshold: number = 0.3
): Promise<DocumentChunk[]> {
  try {
    console.log(`Searching for: "${query}"`);

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Get all embeddings
    const allChunks: Array<DocumentChunk & { similarity: number }> = [];

    const { embeddingsDB } = await initializeDatabases();
    await embeddingsDB.iterate((value: unknown, chunkId: string) => {
      const embeddingData = value as { embedding?: number[]; content?: string; metadata?: unknown };
      if (embeddingData.embedding && embeddingData.content) {
        // Calculate cosine similarity
        const similarity = cosineSimilarity(queryEmbedding, embeddingData.embedding);

        if (similarity > threshold) {
          allChunks.push({
            id: chunkId,
            content: embeddingData.content,
            metadata: embeddingData.metadata as { source: string; page?: number; chunkIndex: number; type: 'pdf' | 'docx' | 'txt' },
            embedding: embeddingData.embedding,
            similarity
          });
        }
      }
    });

    // Sort by similarity and return top K
    const sortedChunks = allChunks
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    console.log(`Found ${sortedChunks.length} relevant chunks`);

    // If no good matches found, try fuzzy text search as fallback
    if (sortedChunks.length === 0) {
      return await fallbackTextSearch(query, topK);
    }

    return sortedChunks;
  } catch (error) {
    console.error('Error searching chunks:', error);
    // Fallback to text search
    return await fallbackTextSearch(query, topK);
  }
}

/**
 * Fallback fuzzy text search when embedding search fails
 */
async function fallbackTextSearch(query: string, topK: number): Promise<DocumentChunk[]> {
  console.log('Using fallback text search');

  const { embeddingsDB } = await initializeDatabases();
  const allChunks: DocumentChunk[] = [];
  await embeddingsDB.iterate((value: unknown, chunkId: string) => {
    const embeddingData = value as { content?: string; metadata?: unknown };
    if (embeddingData.content) {
      allChunks.push({
        id: chunkId,
        content: embeddingData.content,
        metadata: embeddingData.metadata as { source: string; page?: number; chunkIndex: number; type: 'pdf' | 'docx' | 'txt' }
      });
    }
  });

  // Dynamic import for client-side only
  const Fuse = (await import('fuse.js')).default;
  const fuse = new Fuse(allChunks, {
    keys: ['content'],
    threshold: 0.4,
    includeScore: true
  });

  const results = fuse.search(query);
  return results.slice(0, topK).map(result => result.item);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  documentCount: number;
  chunkCount: number;
  totalSize: string;
}> {
  try {
    const documents = await getAllDocuments();
    const totalChunks = documents.reduce((sum, doc) => sum + doc.chunks.length, 0);

    return {
      documentCount: documents.length,
      chunkCount: totalChunks,
      totalSize: `~${Math.round(totalChunks * 0.5)}KB` // Rough estimate
    };
  } catch {
    return {
      documentCount: 0,
      chunkCount: 0,
      totalSize: '0KB'
    };
  }
}

/**
 * Clear all stored documents and embeddings
 */
export async function clearAllDocuments(): Promise<void> {
  try {
    const { documentsDB, embeddingsDB } = await initializeDatabases();
    await documentsDB.clear();
    await embeddingsDB.clear();
    console.log('All documents cleared');
  } catch (error) {
    console.error('Error clearing documents:', error);
    throw new Error('Failed to clear documents');
  }
}