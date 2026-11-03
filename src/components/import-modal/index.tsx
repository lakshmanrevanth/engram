'use client';

import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { X } from 'lucide-react';
import { FileUploadStep } from './file-upload';
import { ColumnMapperStep } from './column-mapper';
import { StrategyPickerStep } from './strategy-picker';
import { ValidationSummaryStep, type ImportResult } from './validation-summary';
import {
  SCHEDULE_FIELDS,
  applyStrategy,
  autoDetectMappings,
  hasScheduleData,
  validateAndProcessRows,
  type BackupParseResult,
  type ParsedFile,
  type ColumnMapping,
  type DuplicateStrategy,
  type ImportRequestBody,
  type ImportStrategy,
  type ValidationResult,
  type Platform,
} from '@/lib/import-utils';
import { normalizeLadder } from '@/lib/scheduling';
import { siteConfig } from '@/config/site';

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImportComplete: (result: ImportResult) => void;
};

const STEPS = [
  { id: 1, label: 'Upload' },
  { id: 2, label: 'Map Columns' },
  { id: 3, label: 'Schedule' },
  { id: 4, label: 'Review & Import' },
];

const PLATFORMS: Platform[] = ['LEETCODE', 'CODEFORCES', 'GFG', 'HACKERRANK', 'CODECHEF'];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export function ImportModal({ open, onClose, onImportComplete }: ImportModalProps) {
  const { data: rawCols } = useSWR('/api/columns', fetcher);
  const { data: settings } = useSWR('/api/settings', fetcher);
  const existingCustomColumns: string[] = Array.isArray(rawCols) ? rawCols.map((c: any) => c.name) : [];
  const ladder = normalizeLadder(settings?.preferences?.ladderDays);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [backup, setBackup] = useState<ValidationResult | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [strategy, setStrategy] = useState<ImportStrategy>('staggered');
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [dailyPace, setDailyPace] = useState<number>(5);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const getDefaultPlatform = (): Platform => {
    const pref = settings?.preferences?.defaultPlatform;
    if (PLATFORMS.includes(pref)) return pref;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('recall_default_platform');
      if (saved && (PLATFORMS as string[]).includes(saved)) return saved as Platform;
    }
    return 'LEETCODE';
  };

  // Confirm before throwing away work in progress.
  const requestClose = useCallback(() => {
    if (isImporting) {
      if (!window.confirm('The import is still running and will finish in the background. Close this window?')) return;
    } else if (step > 1 && !importResult) {
      if (!window.confirm('Discard this import? Nothing has been saved yet.')) return;
    }
    onClose();
  }, [isImporting, step, importResult, onClose]);

  const goToStep = (next: 1 | 2 | 3 | 4, prefix = '') => {
    setStep(next);
    setAnnouncement(`${prefix ? `${prefix}. ` : ''}Step ${next} of ${STEPS.length}: ${STEPS.find((s) => s.id === next)?.label}`);
  };

  // Reset state when opening (derived-state pattern, no effect)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep(1);
      setParsedFile(null);
      setBackup(null);
      setFilename('');
      setColumnMapping({});
      setStrategy('staggered');
      setDuplicateStrategy('skip');
      setDailyPace(5);
      setValidationResult(null);
      setIsValidating(false);
      setIsImporting(false);
      setImportResult(null);
      setImportError(null);
      setAnnouncement('');
    }
  }

  // Move focus into the dialog on open and give it back on close.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    // The step effect focuses the first control; this is the fallback while it animates in.
    const t = setTimeout(() => {
      if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  // Focus the new step's first control when the step changes.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const body = dialogRef.current?.querySelector('.import-modal-body');
      const first = body?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 180);
    return () => clearTimeout(t);
  }, [step, open]);

  const handleDialogKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Step 1: spreadsheet parsed
  const handleFileParsed = (result: ParsedFile, name: string) => {
    setBackup(null);
    setParsedFile(result);
    setFilename(name);
    const initialMap = autoDetectMappings(result.headers, existingCustomColumns);
    setColumnMapping(initialMap);
    goToStep(2, `${result.totalRows} rows read from ${name}`);
  };

  // Step 1: JSON backup parsed — no column mapping needed
  const handleBackupParsed = (parsed: Extract<BackupParseResult, { ok: true }>, name: string) => {
    setParsedFile(null);
    setBackup(parsed.result);
    setFilename(name);
    setStrategy('preserve');
    goToStep(3, `Backup with ${parsed.result.valid.length} problems read from ${name}`);
  };

  // Step 2: Mapping confirmed
  const handleMappingConfirmed = (mapping: ColumnMapping) => {
    setColumnMapping(mapping);
    const mapsSchedule = Object.values(mapping).some((f) => SCHEDULE_FIELDS.includes(f));
    setStrategy((s) => (mapsSchedule ? 'preserve' : s === 'preserve' ? 'staggered' : s));
    goToStep(3);
  };

  const mappingHasSchedule = Object.values(columnMapping).some((f) => SCHEDULE_FIELDS.includes(f));
  const hasSchedule = backup ? hasScheduleData(backup) : mappingHasSchedule;
  const totalProblems = backup ? backup.valid.length : parsedFile?.totalRows ?? 0;

  // Step 3 -> Step 4: Run validation pipeline
  const handleStrategyContinue = async () => {
    if (backup) {
      setValidationResult(applyStrategy(backup, strategy, new Date(), dailyPace, ladder));
      goToStep(4, `${backup.valid.length} problems ready`);
      return;
    }
    if (!parsedFile) return;
    setIsValidating(true);
    setAnnouncement(`Checking ${parsedFile.totalRows} rows`);
    try {
      const result = await validateAndProcessRows(
        parsedFile,
        columnMapping,
        strategy,
        getDefaultPlatform(),
        new Date(),
        dailyPace,
        ladder
      );
      setValidationResult(result);
      goToStep(4, `${result.valid.length} problems ready, ${result.skipped.length} will be skipped`);
    } finally {
      setIsValidating(false);
    }
  };

  // Step 4: Execute API import
  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.valid.length === 0) return;

    setIsImporting(true);
    setImportError(null);
    setAnnouncement(`Importing ${validationResult.valid.length} problems, please wait`);

    try {
      const payload: ImportRequestBody = {
        problems: validationResult.valid,
        customColumns: validationResult.customColumns,
        columnDefs: validationResult.columnDefs,
        streakLogs: validationResult.streakLogs,
        duplicateStrategy,
      };
      const res = await fetch('/api/problems/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Server returned an error while importing');
      }

      const data: ImportResult = await res.json();
      setImportResult(data);
      setAnnouncement(
        `Import complete. ${data.imported} imported${data.updated ? `, ${data.updated} updated` : ''}${data.skipped ? `, ${data.skipped} unchanged` : ''}.`
      );
      onImportComplete(data);
    } catch (err: any) {
      console.error('Import error:', err);
      const msg = err?.message || 'Failed to import problems. Please try again.';
      setImportError(msg);
      setAnnouncement(`Import failed: ${msg}`);
    } finally {
      setIsImporting(false);
    }
  };

  const stepLabel = STEPS.find((s) => s.id === step)?.label;

  return (
    <AnimatePresence>
      {open && (
        <div
          className="import-modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {/* Backdrop */}
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={requestClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--overlay)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />

          {/* Modal Container */}
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            aria-describedby="import-modal-step"
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
            className="import-modal-container"
            initial={{ opacity: 0, scale: 0.98, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: step === 2 ? 820 : 580,
              background: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-modal)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              maxHeight: '90vh',
              zIndex: 1,
              transition: 'max-width 0.2s ease',
              outline: 'none',
            }}
          >
            {/* Progress / status announcements for screen readers */}
            <div role="status" aria-live="polite" aria-atomic="true" style={visuallyHidden}>
              {announcement}
            </div>

            {/* Modal Header — matches dashboard breadcrumbs */}
            <div
              className="import-modal-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--popover)',
              }}
            >
              {/* Monospace Breadcrumb */}
              <h2
                id="import-modal-title"
                className="import-modal-breadcrumb"
                style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 13, fontWeight: 400, margin: 0, display: 'flex', alignItems: 'center' }}
              >
                <span style={{ color: 'var(--text-subtle)' }}>{siteConfig.logoWord}</span>
                <span aria-hidden="true" style={{ color: 'var(--text-subtle)', margin: '0 6px', opacity: 0.6 }}>/</span>
                <span style={{ color: 'var(--text-normal)' }}>import</span>
                <span aria-hidden="true" style={{ color: 'var(--text-subtle)', margin: '0 6px', opacity: 0.6 }}>/</span>
                <span style={{ color: 'var(--text-strong)', fontWeight: 500 }}>{stepLabel}</span>
              </h2>

              {/* Step indicator & Close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  id="import-modal-step"
                  className="import-modal-step-tag"
                  style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                    letterSpacing: '0.04em',
                  }}
                >
                  STEP {step} / {STEPS.length}
                </span>

                <div aria-hidden="true" style={{ width: 1, height: 12, background: 'var(--input-border)' }} />

                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Close import"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: 13,
                    padding: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-strong)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="import-modal-body" style={{ padding: '20px 24px', overflowY: 'auto' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                >
                  {step === 1 && (
                    <FileUploadStep
                      onFileParsed={handleFileParsed}
                      onBackupParsed={handleBackupParsed}
                      onCancel={onClose}
                      onBusyChange={(msg) => msg && setAnnouncement(msg)}
                    />
                  )}

                  {step === 2 && parsedFile && (
                    <ColumnMapperStep
                      parsedFile={parsedFile}
                      filename={filename}
                      initialMapping={columnMapping}
                      existingCustomColumns={existingCustomColumns}
                      onMappingConfirmed={handleMappingConfirmed}
                      onBack={() => goToStep(1)}
                    />
                  )}

                  {step === 3 && (parsedFile || backup) && (
                    <StrategyPickerStep
                      strategy={strategy}
                      onStrategyChange={setStrategy}
                      dailyPace={dailyPace}
                      onDailyPaceChange={setDailyPace}
                      totalProblems={totalProblems}
                      hasSchedule={hasSchedule}
                      firstIntervalDays={ladder[0]}
                      isBusy={isValidating}
                      onContinue={handleStrategyContinue}
                      onBack={() => goToStep(backup ? 1 : 2)}
                    />
                  )}

                  {step === 4 && validationResult && (
                    <ValidationSummaryStep
                      result={validationResult}
                      strategy={strategy}
                      dailyPace={dailyPace}
                      firstIntervalDays={ladder[0]}
                      duplicateStrategy={duplicateStrategy}
                      onDuplicateStrategyChange={setDuplicateStrategy}
                      isBackup={!!backup}
                      isImporting={isImporting}
                      importResult={importResult}
                      importError={importError}
                      onImport={handleExecuteImport}
                      onBack={() => goToStep(3)}
                      onClose={onClose}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
