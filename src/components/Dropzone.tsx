import React, { useState, ChangeEvent, DragEvent } from 'react';

export interface DropzoneProps {
  onFileSelect?: (file: File) => void;
  className?: string;
  title?: string;
  subtitle?: string;
  accept?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  onFileSelect,
  className = '',
  title = 'Drop Your PDF',
  subtitle = 'click to browse · drag & drop',
  accept = '.pdf,application/pdf',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Correct Event Handling Pattern: Only transition UI and state after a valid PDF is chosen
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setSelectedFile(file);
      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))) {
      setSelectedFile(file);
      if (onFileSelect) {
        onFileSelect(file);
      }
    }
  };

  return (
    <div
      className={`pdf-dropzone ${isDragOver ? 'border-orange-500 bg-white/10' : ''} ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderRadius: '24px',
        padding: '36px 42px',
        textAlign: 'center',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '540px',
        width: '100%',
        cursor: 'pointer',
        background: 'rgba(18, 23, 35, 0.94)',
        border: '2px dashed rgba(249, 115, 22, 0.45)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(249, 115, 22, 0.12)',
      }}
    >
      {/* Hidden file input positioned absolute over entire dropzone with opacity: 0 and z-index: 20 */}
      <input
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="dropzone-file-input"
        aria-label="Upload PDF Document"
      />

      {/* Internal icons and typography with pointer-events: none */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '76px',
          height: '76px',
          borderRadius: '20px',
          background: 'rgba(249, 115, 22, 0.12)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          marginBottom: '14px',
          boxShadow: '0 0 20px rgba(249, 115, 22, 0.25)',
        }}
      >
        <svg
          width="42"
          height="42"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f97316"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 8px rgba(249, 115, 22, 0.6))' }}
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="12" y2="12" />
          <line x1="15" y1="15" x2="12" y2="12" />
        </svg>
      </div>

      <div
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: '6px',
          letterSpacing: '-0.5px',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
        }}
      >
        {selectedFile ? selectedFile.name : title}
      </div>

      <p
        style={{
          color: '#f97316',
          fontFamily: "'Space Mono', monospace",
          fontSize: '12px',
          letterSpacing: '1px',
          fontWeight: 500,
          margin: '0 0 14px 0',
        }}
      >
        {subtitle}
      </p>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'center',
          marginTop: '6px',
        }}
      >
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '10px',
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            border: '1px solid #f97316',
            color: '#f97316',
            background: 'rgba(249, 115, 22, 0.12)',
          }}
        >
          PDF
        </span>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '10px',
            fontFamily: "'Space Mono', monospace",
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#e8e6e3',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          BOOKS
        </span>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '10px',
            fontFamily: "'Space Mono', monospace",
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#e8e6e3',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        >
          DOCS
        </span>
      </div>
    </div>
  );
};

export default Dropzone;
