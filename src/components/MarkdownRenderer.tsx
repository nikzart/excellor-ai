'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Copy, Check } from 'lucide-react';

// All Prism imports will be handled dynamically to prevent SSR issues

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  children: string;
  className?: string;
}

const CodeBlock = ({ children, className }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const language = className?.replace('language-', '') || 'text';

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-gray-800 dark:bg-gray-900 px-4 py-2 rounded-t-lg">
        <span className="text-sm text-gray-300 font-mono">{language}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-1 text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span className="text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="bg-gray-900 dark:bg-black p-4 rounded-b-lg overflow-x-auto">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};

const MarkdownRenderer = ({ content, className = '' }: MarkdownRendererProps) => {
  useEffect(() => {
    // Dynamically import and apply Prism highlighting
    const applyHighlighting = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Import Prism core
          const { default: Prism } = await import('prismjs');

          // Load theme CSS dynamically
          const themeLink = document.createElement('link');
          themeLink.rel = 'stylesheet';
          themeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
          document.head.appendChild(themeLink);

          // Import additional language components (with type assertion for build)
          await Promise.all([
            import('prismjs/components/prism-javascript' as any),
            import('prismjs/components/prism-typescript' as any),
            import('prismjs/components/prism-jsx' as any),
            import('prismjs/components/prism-tsx' as any),
            import('prismjs/components/prism-python' as any),
            import('prismjs/components/prism-java' as any),
            import('prismjs/components/prism-c' as any),
            import('prismjs/components/prism-cpp' as any),
            import('prismjs/components/prism-csharp' as any),
            import('prismjs/components/prism-go' as any),
            import('prismjs/components/prism-rust' as any),
            import('prismjs/components/prism-sql' as any),
            import('prismjs/components/prism-json' as any),
            import('prismjs/components/prism-yaml' as any),
            import('prismjs/components/prism-bash' as any),
            import('prismjs/components/prism-markdown' as any)
          ].map(p => p.catch(() => {}))); // Ignore loading errors

          // Apply syntax highlighting
          setTimeout(() => {
            Prism.highlightAll();
          }, 100);
        } catch (error) {
          console.warn('Failed to load Prism highlighting:', error);
        }
      }
    };

    applyHighlighting();
  }, [content]);

  return (
    <div className={`prose prose-slate dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom code block component
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-red-600 dark:text-red-400"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock className={className}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },

          // Custom heading styles
          h1({ children }) {
            return (
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 mt-6 pb-2 border-b border-gray-200 dark:border-gray-700">
                {children}
              </h1>
            );
          },

          h2({ children }) {
            return (
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3 mt-5">
                {children}
              </h2>
            );
          },

          h3({ children }) {
            return (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 mt-4">
                {children}
              </h3>
            );
          },

          // Custom paragraph styling
          p({ children }) {
            return (
              <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
                {children}
              </p>
            );
          },

          // Custom list styling
          ul({ children }) {
            return (
              <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
                {children}
              </ul>
            );
          },

          ol({ children }) {
            return (
              <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
                {children}
              </ol>
            );
          },

          li({ children }) {
            return (
              <li className="ml-4">
                {children}
              </li>
            );
          },

          // Custom blockquote styling
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300">
                {children}
              </blockquote>
            );
          },

          // Custom table styling
          table({ children }) {
            return (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                  {children}
                </table>
              </div>
            );
          },

          thead({ children }) {
            return (
              <thead className="bg-gray-50 dark:bg-gray-800">
                {children}
              </thead>
            );
          },

          th({ children }) {
            return (
              <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                {children}
              </th>
            );
          },

          td({ children }) {
            return (
              <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300">
                {children}
              </td>
            );
          },

          // Custom link styling
          a({ href, children }) {
            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },

          // Custom strong/bold styling
          strong({ children }) {
            return (
              <strong className="font-bold text-gray-900 dark:text-gray-100">
                {children}
              </strong>
            );
          },

          // Custom emphasis/italic styling
          em({ children }) {
            return (
              <em className="italic text-gray-800 dark:text-gray-200">
                {children}
              </em>
            );
          },

          // Custom horizontal rule
          hr() {
            return (
              <hr className="my-6 border-t border-gray-300 dark:border-gray-600" />
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;