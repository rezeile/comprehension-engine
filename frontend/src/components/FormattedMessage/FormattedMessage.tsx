import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Components } from 'react-markdown';
import './FormattedMessage.css';

interface FormattedMessageProps {
  content: string;
  className?: string;
  variant?: 'default' | 'lecture';
}

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'text' }) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
        <button 
          className={`code-block-copy ${copied ? 'copied' : ''}`}
          onClick={copyToClipboard}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          background: '#2d3748',
          borderRadius: 0,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const FormattedMessage: React.FC<FormattedMessageProps> = ({ content, className = '', variant = 'default' }) => {
  // Convert plain text patterns to markdown if needed
  const convertPlainTextToMarkdown = (text: string): string => {
    return text
      // Convert Unicode bullets to markdown
      .replace(/^[\s]*[•·]\s+(.+)$/gm, '- $1')
      // Convert numbered lists  
      .replace(/^[\s]*(\d+)\.\s+(.+)$/gm, '$1. $2')
      // Preserve code blocks if they exist
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '```$1\n$2```');
  };

  // Check if content might already be markdown or needs conversion
  const isMarkdown = /[*_`#\[\]]/g.test(content) || /^[\s]*[-*+]\s/gm.test(content);
  const processedContent = isMarkdown ? content : convertPlainTextToMarkdown(content);

  const components: Components = {
    code: (props: any) => {
      const { inline, className, children } = props;
      const match = /language-(\w+)/.exec(className || '');
      
      if (!inline && match) {
        const code = String(children).replace(/\n$/, '');
        return <CodeBlock code={code} language={match[1]} />;
      }
      
      return <code className={className}>{children}</code>;
    },
    // Custom table rendering to ensure proper styling
    table({ children, ...props }) {
      return (
        <div className="table-wrapper">
          <table {...props}>
            {children}
          </table>
        </div>
      );
    },
    // Custom paragraph rendering to handle line breaks properly
    p({ children, ...props }) {
      return <p {...props}>{children}</p>;
    },
  };

  return (
    <div className={`formatted-message ${variant === 'lecture' ? 'formatted-message--lecture' : ''} ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default FormattedMessage;
