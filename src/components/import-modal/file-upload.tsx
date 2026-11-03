'use client';

import { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { siteConfig } from '@/config/site';
import {
  MAX_BACKUP_BYTES,
  MAX_IMPORT_ROWS,
  MAX_SPREADSHEET_BYTES,
  detectFileType,
  parseBackup,
  parseCsvFile,
  parseExcelFile,
  type BackupParseResult,
  type ParsedFile,
} from '@/lib/import-utils';

type FileUploadStepProps = {
  onFileParsed: (result: ParsedFile, filename: string) => void;
  onBackupParsed: (backup: Extract<BackupParseResult, { ok: true }>, filename: string) => void;
  onCancel: () => void;
  onBusyChange?: (message: string | null) => void;
};

const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`;

export function FileUploadStep({ onFileParsed, onBackupParsed, onCancel, onBusyChange }: FileUploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);

    // 1. File type check
    const type = detectFileType(file);
    if (type === 'unsupported') {
      setError(`Unsupported file format. Please upload a .csv, .xlsx, .xls, or ${siteConfig.name} .json backup.`);
      return;
    }

    // 2. File size check
    const limit = type === 'json' ? MAX_BACKUP_BYTES : MAX_SPREADSHEET_BYTES;
    if (file.size > limit) {
      setError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is ${mb(limit)}.`);
      return;
    }
    if (file.size === 0) {
      setError('This file is empty.');
      return;
    }

    setIsParsing(true);
    onBusyChange?.(`Reading ${file.name}`);
    try {
      if (type === 'json') {
        const backup = parseBackup(await file.text());
        if (!backup.ok) {
          setError(backup.error);
          return;
        }
        if (backup.result.valid.length === 0) {
          setError('No valid problems found in this backup.');
          return;
        }
        onBackupParsed(backup, file.name);
        return;
      }

      let parsed: ParsedFile;
      if (type === 'csv') {
        parsed = await parseCsvFile(file);
      } else {
        parsed = await parseExcelFile(file);
      }

      if (!parsed.headers || parsed.headers.length === 0) {
        setError('No column headers detected in the file.');
        return;
      }

      if (parsed.totalRows === 0) {
        setError('No data rows found below the header row.');
        return;
      }

      if (parsed.totalRows > MAX_IMPORT_ROWS) {
        setError(`Too many rows (${parsed.totalRows.toLocaleString()} found). The limit is ${MAX_IMPORT_ROWS.toLocaleString()} per import.`);
        return;
      }

      onFileParsed(parsed, file.name);
    } catch (err: any) {
      console.error('Failed to parse spreadsheet:', err);
      setError(err?.message || 'Failed to parse spreadsheet.');
    } finally {
      setIsParsing(false);
      onBusyChange?.(null);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-white)', margin: 0, marginBottom: 4 }}>
          Upload Problem List
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
          Import problems from a CSV or Excel spreadsheet, or restore a {siteConfig.name} JSON backup.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv, .xlsx, .xls, .json, text/csv, application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        style={{ display: 'none' }}
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          handleInputChange(e);
          e.target.value = '';
        }}
      />

      {/* Minimalist Dropzone */}
      <div
        className="import-dropzone"
        role="button"
        tabIndex={0}
        aria-label={`Choose a file to import: CSV, Excel or ${siteConfig.name} JSON backup`}
        aria-describedby="import-file-hint"
        aria-busy={isParsing}
        onClick={() => !isParsing && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isParsing) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${isDragging ? 'var(--import-dropzone-drag-border)' : 'var(--import-dropzone-border)'}`,
          borderRadius: 6,
          background: isDragging ? 'var(--import-dropzone-drag-bg)' : 'var(--import-dropzone-bg)',
          padding: '44px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          cursor: isParsing ? 'wait' : 'pointer',
          transition: 'border-color 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isDragging) e.currentTarget.style.borderColor = 'var(--import-dropzone-hover-border)';
        }}
        onMouseLeave={(e) => {
          if (!isDragging) e.currentTarget.style.borderColor = 'var(--import-dropzone-border)';
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            background: 'var(--import-icon-box-bg)',
            border: '1px solid var(--import-icon-box-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-normal)',
          }}
        >
          {isParsing ? (
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-normal)' }} />
          ) : (
            <FileSpreadsheet size={18} />
          )}
        </div>

        {isParsing ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-normal)' }}>Reading file...</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 500 }}>
              Click to select a file <span style={{ color: 'var(--text-normal)', fontWeight: 400 }}>or drag and drop</span>
            </div>
            <div
              id="import-file-hint"
              style={{
                fontSize: 11.5,
                color: 'var(--text-dim)',
                marginTop: 4,
                fontFamily: 'var(--font-geist-mono), monospace',
              }}
            >
              .csv, .xlsx, .xls up to {mb(MAX_SPREADSHEET_BYTES)} • .json backup up to {mb(MAX_BACKUP_BYTES)} • {MAX_IMPORT_ROWS.toLocaleString()} rows max
            </div>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--import-error-bg)',
            border: '1px solid var(--import-error-border)',
            borderRadius: 6,
            padding: '8px 12px',
            color: 'var(--import-error-color)',
            fontSize: 12.5,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Action Footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'none',
            border: '1px solid var(--import-back-btn-border)',
            borderRadius: 6,
            color: 'var(--import-back-btn-color)',
            fontSize: 13,
            padding: '6px 14px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--import-back-btn-hover-border)';
            e.currentTarget.style.color = 'var(--text-white)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--import-back-btn-border)';
            e.currentTarget.style.color = 'var(--import-back-btn-color)';
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
