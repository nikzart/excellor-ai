'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, BookOpen, TrendingUp, Users, Brain, FileText, Search, MessageSquareX, Trash2, Menu, X, Plus, Settings, HelpCircle, Sparkles, Upload, Zap } from 'lucide-react';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import DocumentUpload from '@/components/DocumentUpload';
import { searchSimilarChunks, DocumentChunk, clearAllDocuments } from '@/lib/vectorDatabase';
import { ProcessedDocument } from '@/lib/documentProcessor';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ragContext?: DocumentChunk[];
}

// Client-side timestamp component to prevent hydration mismatches
function ClientTimestamp({ timestamp, className }: { timestamp: Date; className?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={className}>--:--:--</div>;
  }

  return <div className={className}>{timestamp.toLocaleTimeString()}</div>;
}

export default function ExcellorAI() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! 👋 This is **EXCELLOR AI** with **Document RAG Support**. I'm here to help you with:

## 📚 UPSC Preparation Areas
- **Polity & Governance** - Constitutional framework, institutions
- **History** - Ancient, Medieval & Modern Indian History
- **Geography** - Physical & Human Geography
- **Economics** - Indian Economy, Development issues
- **Current Affairs** - Daily updates and analysis

## 🔥 Advanced Features
\`\`\`markdown
✅ Real-time markdown support
✅ Code syntax highlighting
✅ Document RAG (PDF, DOCX, TXT)
✅ Azure OpenAI embeddings (text-embedding-3-large)
✅ High-quality vector search
✅ Interactive chat experience
\`\`\`

## 📄 Document RAG
Upload your study materials and I'll reference them in my responses:
- **PDF** - Study guides, previous year papers
- **DOCX** - Notes, current affairs compilations
- **TXT** - Quick reference materials

> **Tip:** Upload documents first, then ask questions about their content for personalized responses!

How would you like to start your UPSC preparation journey today?`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [showDocumentPanel, setShowDocumentPanel] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);
  const [showClearDocsConfirm, setShowClearDocsConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: `Hello! 👋 This is **EXCELLOR AI** with **Document RAG Support**. I'm here to help you with:

## 📚 UPSC Preparation Areas
- **Polity & Governance** - Constitutional framework, institutions
- **History** - Ancient, Medieval & Modern Indian History
- **Geography** - Physical & Human Geography
- **Economics** - Indian Economy, Development issues
- **Current Affairs** - Daily updates and analysis

## 🔥 Advanced Features
\`\`\`markdown
✅ Real-time markdown support
✅ Code syntax highlighting
✅ Document RAG (PDF, DOCX, TXT)
✅ Azure OpenAI embeddings (text-embedding-3-large)
✅ High-quality vector search
✅ Interactive chat experience
\`\`\`

## 📄 Document RAG
Upload your study materials and I'll reference them in my responses:
- **PDF** - Study guides, previous year papers
- **DOCX** - Notes, current affairs compilations
- **TXT** - Quick reference materials

> **Tip:** Upload documents first, then ask questions about their content for personalized responses!

How would you like to start your UPSC preparation journey today?`,
        timestamp: new Date()
      }
    ]);
    setInput('');
    setShowClearChatConfirm(false);
  };

  const clearDocuments = async () => {
    try {
      await clearAllDocuments();
      setDocuments([]);
      setShowClearDocsConfirm(false);
      // Show success message briefly
      const successMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: '✅ **Documents cleared successfully!** All uploaded documents and their embeddings have been removed from storage.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      console.error('Error clearing documents:', error);
      const errorMessage = {
        id: Date.now().toString(),
        role: 'assistant' as const,
        content: '❌ **Failed to clear documents.** Please try again or refresh the page.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    // You may want to also remove from vector database here
    // await removeDocumentFromVectorDB(documentId);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // Search for relevant document chunks if RAG is enabled and documents exist
      let ragContext: DocumentChunk[] = [];
      if (ragEnabled && documents.length > 0) {
        try {
          ragContext = await searchSimilarChunks(currentInput, 3);
          console.log(`Found ${ragContext.length} relevant document chunks`);
        } catch (error) {
          console.warn('RAG search failed, continuing without context:', error);
        }
      }

      // Prepare messages with RAG context
      let contextualMessages: Array<{ role: string; content: string }> = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // If we have RAG context, add it to the system prompt
      if (ragContext.length > 0) {
        const ragContent = ragContext.map((chunk, index) =>
          `**Reference ${index + 1} (${chunk.metadata.source}):**\n${chunk.content}`
        ).join('\n\n');

        const ragSystemMessage = {
          role: 'system' as const,
          content: `You are EXCELLOR AI, a UPSC preparation assistant. Use the following document references to enhance your response when relevant:\n\n${ragContent}\n\nBe sure to cite sources when referencing the documents. If the documents don't contain relevant information, provide your general knowledge response.`
        };

        contextualMessages = [ragSystemMessage, ...contextualMessages];
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: contextualMessages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        ragContext: ragContext.length > 0 ? ragContext : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsLoading(false);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + content }
                    : msg
                ));
              }
            } catch {
              // Ignore parsing errors for streaming data
            }
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    { icon: BookOpen, text: 'UPSC Preparation', query: 'Help me with UPSC preparation strategy' },
    { icon: TrendingUp, text: 'Current Affairs', query: 'What are the latest current affairs for UPSC?' },
    { icon: Users, text: 'Polity & Governance', query: 'Explain Indian polity concepts' },
    { icon: Brain, text: 'General Knowledge', query: 'Test my general knowledge' }
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden transition-all duration-300 ease-out animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
        transform transition-all duration-300 ease-out md:transform-none shadow-xl md:shadow-none
        ${sidebarOpen ? 'translate-x-0 animate-slide-in-left' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  EXCELLOR AI
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">UPSC Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <button
              onClick={clearChat}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-spring shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">New Chat</span>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="px-4 pb-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 px-2">Quick Start</h3>
            <div className="space-y-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInput(action.query);
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 p-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-smooth group hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 group-hover:from-blue-200 group-hover:to-purple-200 dark:group-hover:from-blue-800/30 dark:group-hover:to-purple-800/30 transition-smooth group-hover:scale-110">
                    <action.icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{action.text}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Documents Section */}
          <div className="flex-1 px-4 pb-4 overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Documents</h3>
              <button
                onClick={() => setShowDocumentPanel(!showDocumentPanel)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-smooth hover:scale-110 active:scale-95"
                title="Upload documents"
              >
                <Upload className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {documents.length > 0 ? (
              <div className="space-y-1 overflow-y-auto max-h-48">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-smooth group hover:scale-[1.01] animate-slide-up"
                  >
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-500">{doc.chunks.length} chunks</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-smooth hover:scale-110 active:scale-95"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No documents uploaded</p>
              </div>
            )}
          </div>

          {/* Settings Section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              {/* RAG Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">RAG Mode</span>
                </div>
                <button
                  onClick={() => setRagEnabled(!ragEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-smooth focus:outline-none hover:scale-105 active:scale-95 ${
                    ragEnabled ? 'bg-gradient-to-r from-blue-600 to-purple-600' : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-spring shadow-sm ${
                    ragEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Clear Documents */}
              {documents.length > 0 && (
                <button
                  onClick={() => setShowClearDocsConfirm(true)}
                  className="w-full flex items-center space-x-2 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-smooth text-red-600 dark:text-red-400 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="text-sm">Clear All Documents</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Main Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-smooth hover:scale-110 active:scale-95"
              >
                <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="hidden md:flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">AI Chat</h2>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="hidden sm:inline">Online</span>
              </div>
            </div>
          </div>
        </header>

        {/* Document Upload Panel */}
        {showDocumentPanel && (
          <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="p-6">
              <DocumentUpload
                onDocumentsChange={setDocuments}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
            {/* Welcome Message for Empty State */}
            {messages.length === 1 && (
              <div className="text-center py-12 animate-fade-in-scale">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-3">
                  Welcome to EXCELLOR AI
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
                  Your intelligent UPSC preparation assistant powered by advanced AI and document RAG
                </p>

                {/* Suggested Prompts */}
                <div className="grid gap-3 max-w-2xl mx-auto">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => setInput(action.query)}
                      className="flex items-center space-x-3 p-4 bg-white dark:bg-gray-800 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-spring group shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <div className="p-2 rounded-lg bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 group-hover:from-blue-200 group-hover:to-purple-200 dark:group-hover:from-blue-800/30 dark:group-hover:to-purple-800/30 transition-smooth group-hover:scale-110">
                        <action.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-left font-medium text-gray-800 dark:text-gray-200">{action.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end animate-slide-in-right' : 'justify-start animate-slide-in-left'}`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={`flex max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 ${message.role === 'user' ? 'ml-3' : 'mr-3'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                        : 'bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700'
                    }`}>
                      {message.role === 'user' ? (
                        <span className="text-white text-sm font-medium">U</span>
                      ) : (
                        <Brain className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`rounded-2xl px-6 py-4 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <>
                          <MarkdownRenderer content={message.content} />

                          {/* RAG Context */}
                          {message.ragContext && message.ragContext.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex items-center space-x-2 mb-3">
                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                  <Search className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                </div>
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                                  Referenced Documents
                                </span>
                              </div>
                              <div className="space-y-2">
                                {message.ragContext.map((chunk, idx) => (
                                  <div key={idx} className="flex items-center space-x-2 text-sm">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    <span className="text-gray-700 dark:text-gray-300 font-medium">{chunk.metadata.source}</span>
                                    {chunk.metadata.page && (
                                      <span className="text-gray-500 dark:text-gray-400">Page {chunk.metadata.page}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="whitespace-pre-wrap text-white">{message.content}</div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <ClientTimestamp
                      timestamp={message.timestamp}
                      className={`text-xs mt-2 ${
                        message.role === 'user' ? 'text-right text-gray-500' : 'text-gray-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start animate-slide-up">
                <div className="flex max-w-[85%]">
                  <div className="flex-shrink-0 mr-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-4 shadow-sm animate-shimmer">
                    <div className="flex items-center space-x-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">EXCELLOR AI is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me about UPSC preparation, current affairs, or any topic..."
                className="w-full resize-none border border-gray-200 dark:border-gray-600 rounded-2xl px-6 py-4 pr-14 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-blue-400/20 transition-all duration-200 shadow-sm focus:shadow-md"
                rows={1}
                style={{
                  maxHeight: '120px',
                  minHeight: '56px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-spring shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95 disabled:transform-none animate-pulse-glow disabled:animate-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Chat Confirmation Dialog */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md mx-4 shadow-xl animate-scale-in">
            <div className="flex items-center space-x-3 mb-4">
              <MessageSquareX className="w-6 h-6 text-orange-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Clear Chat History
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to clear all chat messages? This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowClearChatConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-smooth hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={clearChat}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-smooth hover:scale-105 active:scale-95"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Documents Confirmation Dialog */}
      {showClearDocsConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md mx-4 shadow-xl animate-scale-in">
            <div className="flex items-center space-x-3 mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Clear All Documents
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete all uploaded documents and their embeddings?
              This will remove <strong>{documents.length} document{documents.length !== 1 ? 's' : ''}</strong> from storage.
              This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowClearDocsConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-smooth hover:scale-105 active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={clearDocuments}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-smooth hover:scale-105 active:scale-95"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}