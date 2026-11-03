'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { PlatformLogo } from '@/lib/platforms/logos';
import { Upload, Mail } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { ImportModal } from '@/components/import-modal';
import { ThemeToggle } from '@/components/theme-toggle';
import type { UserPreferences, Platform } from '@/lib/preferences';
import { AccountSection } from './account-section';
import {
  ActionButton,
  Card,
  StatusText,
  Switch,
  cardStyle,
  hintStyle,
  inputStyle,
  labelStyle,
  requestJson,
  useSaveState,
} from './ui';

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: 'LEETCODE', label: 'LeetCode' },
  { id: 'CODEFORCES', label: 'Codeforces' },
  { id: 'GFG', label: 'GeeksforGeeks' },
  { id: 'HACKERRANK', label: 'HackerRank' },
  { id: 'CODECHEF', label: 'CodeChef' },
];

const DEFAULT_LADDER = [3, 7, 14, 30];
const GOAL_PRESETS = [3, 5, 10, 15];
const NAME_MAX = 60;

// The daily page and import modal still read these keys, so keep them in sync with the server.
const LS_DAILY_TARGET = 'recall_daily_target';
const LS_DEFAULT_PLATFORM = 'recall_default_platform';

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const FALLBACK_ZONES = [
  'UTC', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Moscow', 'Africa/Cairo', 'Africa/Lagos',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Shanghai',
  'Asia/Tokyo', 'Australia/Sydney', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/New_York',
  'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Pacific/Honolulu',
];

function allTimeZones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const list = fn ? fn('timeZone') : [];
    if (list.length > 0) return list.includes('UTC') ? list : ['UTC', ...list];
  } catch {
    // older browsers
  }
  return FALLBACK_ZONES;
}

function formatHour(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${suffix}`;
}

/** Client copy of the server's ladder rule: 4 increasing whole numbers, 1-365. */
function ladderError(values: string[]): string | null {
  const nums = values.map((v) => Number(v));
  if (values.some((v) => v.trim() === '') || nums.some((n) => !Number.isInteger(n))) return 'Each interval must be a whole number of days.';
  if (nums.some((n) => n < 1 || n > 365)) return 'Intervals must be between 1 and 365 days.';
  if (nums.some((n, i) => i > 0 && n <= nums[i - 1])) return 'Each interval must be longer than the one before it.';
  return null;
}

function SettingsSkeleton() {
  const bar = (w: number | string, h: number, extra?: React.CSSProperties) => (
    <div className="animate-pulse" style={{ width: w, height: h, borderRadius: 4, background: 'var(--daily-row-skeleton)', ...extra }} />
  );
  return (
    <div data-settings-cards style={{ display: 'flex', flexDirection: 'column', gap: 24 }} aria-busy="true" aria-label="Loading settings">
      {[0, 1, 2].map((i) => (
        <div key={i} data-settings-card style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            {bar(16, 16)}
            {bar(120, 16)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
            {bar(90, 12)}
            {bar('100%', 36, { borderRadius: 6 })}
            {bar(140, 12)}
            {bar('100%', 36, { borderRadius: 6 })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { update: updateSession } = useSession();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [email, setEmail] = useState('');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);

  const [ladderDraft, setLadderDraft] = useState<string[]>(DEFAULT_LADDER.map(String));
  const [customGoal, setCustomGoal] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importToast, setImportToast] = useState<string | null>(null);

  const nameSave = useSaveState();
  const prefSave = useSaveState();
  const ladderSave = useSaveState();
  const reminderSave = useSaveState();

  const zones = useMemo(() => allTimeZones(), []);
  const [detectedTz] = useState(() => (typeof window === 'undefined' ? null : browserTimeZone()));

  const applyPrefs = useCallback((p: UserPreferences) => {
    setPrefs(p);
    setLadderDraft(p.ladderDays.map(String));
    writeLocal(LS_DAILY_TARGET, String(p.dailyGoal));
    writeLocal(LS_DEFAULT_PLATFORM, p.defaultPlatform);
  }, []);

  /** PATCH /api/settings and apply the returned preferences. Throws with the server message. */
  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const data = await requestJson<{ preferences: UserPreferences; user: { name: string | null } }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      applyPrefs(data.preferences);
      return data;
    },
    [applyPrefs]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await requestJson<{ user: { name: string | null; email: string }; preferences: UserPreferences }>(
        '/api/settings'
      );
      setName(data.user.name || '');
      setSavedName(data.user.name || '');
      setEmail(data.user.email || '');
      applyPrefs(data.preferences);
      // First visit: store the browser's timezone so streaks and reminders use the right day.
      if (!data.preferences.timezone && detectedTz && zones.includes(detectedTz)) {
        patch({ timezone: detectedTz }).catch(() => undefined);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, [applyPrefs, detectedTz, patch, zones]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const savePref = (body: Partial<UserPreferences>, message = 'Saved') => {
    if (!prefs) return;
    // Optimistic update; revert if the server rejects it.
    const before = prefs;
    setPrefs({ ...prefs, ...body });
    void prefSave.run(() => patch(body), message).then((ok) => {
      if (!ok) setPrefs(before);
    });
  };

  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed) return nameSave.fail('Name cannot be empty');
    if (trimmed.length > NAME_MAX) return nameSave.fail(`Name must be at most ${NAME_MAX} characters`);
    const ok = await nameSave.run(() => patch({ name: trimmed }), 'Name updated');
    if (ok) {
      setName(trimmed);
      setSavedName(trimmed);
      await updateSession().catch(() => undefined);
    }
  };

  const saveLadder = async () => {
    const err = ladderError(ladderDraft);
    if (err) return ladderSave.fail(err);
    await ladderSave.run(() => patch({ ladderDays: ladderDraft.map(Number) }), 'Intervals saved');
  };

  const resetLadder = async () => {
    setLadderDraft(DEFAULT_LADDER.map(String));
    await ladderSave.run(() => patch({ ladderDays: DEFAULT_LADDER }), 'Intervals reset to 3 / 7 / 14 / 30');
  };

  const saveReminders = (body: Partial<UserPreferences>) => {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...body });
    const msg =
      body.remindersEnabled === false
        ? 'Reminders turned off'
        : `Reminder set for ${formatHour(body.reminderHour ?? prefs.reminderHour)}`;
    void reminderSave.run(() => patch(body), msg).then((ok) => {
      if (!ok) setPrefs(before);
    });
  };

  const selectedPlatformObj = PLATFORMS.find((p) => p.id === prefs?.defaultPlatform) || PLATFORMS[0];
  const initial = name ? name.charAt(0).toUpperCase() : email ? email.charAt(0).toUpperCase() : 'U';
  const ladderValidation = ladderError(ladderDraft);
  const ladderDirty = prefs ? ladderDraft.join() !== prefs.ladderDays.join() : false;
  const tzOptions = prefs?.timezone && !zones.includes(prefs.timezone) ? [prefs.timezone, ...zones] : zones;
  const effectiveTz = prefs?.timezone ?? 'UTC';

  return (
    <div data-settings-container style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <div data-settings-header style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', letterSpacing: '-0.02em', marginBottom: 6 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Manage your account, review schedule, reminders and data backups.
        </p>
      </div>

      {loading ? (
        <SettingsSkeleton />
      ) : loadError || !prefs ? (
        <div data-settings-card style={cardStyle} role="alert">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-strong)', marginBottom: 6 }}>Could not load settings</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 14 }}>{loadError ?? 'Please try again.'}</p>
          <ActionButton onClick={load}>Try again</ActionButton>
        </div>
      ) : (
        <div data-settings-cards style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Profile */}
          <Card
            title="Profile"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          >
            <div data-settings-avatar-row style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div
                data-settings-avatar
                aria-hidden="true"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #222226 0%, #18181b 100%)',
                  border: '1px solid var(--settings-card-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#ffffff',
                  fontFamily: 'var(--font-geist-mono), monospace',
                }}
              >
                {initial}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-strong)' }}>{savedName || 'User'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{email}</div>
              </div>
            </div>

            <div data-settings-form style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420 }}>
              <div>
                <label htmlFor="display-name" style={labelStyle}>Display name</label>
                <div data-display-name-row style={{ display: 'flex', gap: 8 }}>
                  <input
                    id="display-name"
                    type="text"
                    value={name}
                    maxLength={NAME_MAX}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleSaveName();
                    }}
                    placeholder="Your display name"
                    style={{ ...inputStyle, flex: 1, width: 'auto' }}
                  />
                  <ActionButton
                    onClick={handleSaveName}
                    disabled={nameSave.state.status === 'saving' || name.trim() === savedName}
                    style={{ padding: '0 16px' }}
                  >
                    {nameSave.state.status === 'saving' ? 'Saving…' : 'Save'}
                  </ActionButton>
                </div>
                <StatusText state={nameSave.state} />
              </div>

              <div>
                <button
                  data-sign-out-btn
                  type="button"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  style={{
                    background: 'var(--error-bg)',
                    border: '1px solid var(--error-border)',
                    borderRadius: 6,
                    color: 'var(--error)',
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '8px 14px',
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </Card>

          {/* Preferences */}
          <Card
            title="Preferences"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5 6h6M5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          >
            <div data-settings-form style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 420 }}>
              {/* Default platform */}
              <div style={{ position: 'relative' }}>
                <span id="platform-label" style={labelStyle}>Default coding platform</span>
                <button
                  data-platform-trigger
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={dropdownOpen}
                  aria-labelledby="platform-label platform-value"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setDropdownOpen(false);
                  }}
                  style={{
                    ...inputStyle,
                    color: 'var(--text-strong)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <PlatformLogo platform={selectedPlatformObj.id} size={18} padding={1} />
                    <span id="platform-value" style={{ fontSize: 13, fontWeight: 500 }}>{selectedPlatformObj.label}</span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    style={{
                      color: 'var(--text-dim)',
                      transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div
                    role="listbox"
                    aria-labelledby="platform-label"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      background: 'var(--popover)',
                      border: '1px solid var(--popover-border)',
                      borderRadius: 8,
                      padding: 4,
                      zIndex: 30,
                      boxShadow: 'var(--shadow-modal)',
                    }}
                  >
                    {PLATFORMS.map((plat) => {
                      const isSelected = plat.id === prefs.defaultPlatform;
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setDropdownOpen(false);
                            if (!isSelected) savePref({ defaultPlatform: plat.id }, `Default platform: ${plat.label}`);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setDropdownOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '8px 10px',
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--dropdown-item-hover-bg)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'var(--dropdown-item-hover-bg)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <PlatformLogo platform={plat.id} size={18} padding={1} />
                            <span style={{ fontSize: 13, color: isSelected ? 'var(--text-strong)' : 'var(--text-normal)', fontWeight: isSelected ? 600 : 400 }}>
                              {plat.label}
                            </span>
                          </span>
                          {isSelected && <span aria-hidden="true" style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                <span style={hintStyle}>Pre-selected platform when adding new problems.</span>
              </div>

              {/* Daily goal */}
              <div>
                <span id="goal-label" style={labelStyle}>Daily revision goal</span>
                <div data-daily-target-grid role="group" aria-labelledby="goal-label" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {GOAL_PRESETS.map((targetVal) => {
                    const active = prefs.dailyGoal === targetVal;
                    return (
                      <button
                        key={targetVal}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setCustomGoal('');
                          if (!active) savePref({ dailyGoal: targetVal }, `Daily goal: ${targetVal}`);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 64,
                          padding: '7px 0',
                          borderRadius: 6,
                          background: active ? 'var(--target-btn-active-bg)' : 'var(--target-btn-inactive-bg)',
                          border: active ? '1px solid var(--target-btn-active-border)' : '1px solid var(--target-btn-inactive-border)',
                          color: active ? 'var(--target-btn-active-color)' : 'var(--target-btn-inactive-color)',
                          fontSize: 13,
                          fontWeight: active ? 600 : 400,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-geist-mono), monospace',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {targetVal} / day
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <label htmlFor="custom-goal" style={{ fontSize: 12, color: 'var(--text-dim)' }}>Custom</label>
                  <input
                    id="custom-goal"
                    type="number"
                    min={1}
                    max={200}
                    inputMode="numeric"
                    placeholder={GOAL_PRESETS.includes(prefs.dailyGoal) ? '' : String(prefs.dailyGoal)}
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    style={{ ...inputStyle, width: 90, padding: '6px 10px' }}
                  />
                  <ActionButton
                    disabled={!customGoal}
                    onClick={() => {
                      const n = Number(customGoal);
                      if (!Number.isInteger(n) || n < 1 || n > 200) return prefSave.fail('Daily goal must be between 1 and 200');
                      setCustomGoal('');
                      savePref({ dailyGoal: n }, `Daily goal: ${n}`);
                    }}
                    style={{ padding: '6px 12px' }}
                  >
                    Set
                  </ActionButton>
                </div>
                <span style={hintStyle}>
                  Target number of revisions per day. Current goal: <strong style={{ color: 'var(--text-normal)' }}>{prefs.dailyGoal}</strong>.
                </span>
              </div>

              {/* Goal-based streak */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <label htmlFor="goal-streak" style={{ ...labelStyle, marginBottom: 2, color: 'var(--text-strong)' }}>
                    Streak counts only when the daily goal is met
                  </label>
                  <span style={{ ...hintStyle, marginTop: 0 }}>
                    Off: any revision keeps your streak. On: you need {prefs.dailyGoal} revisions that day.
                  </span>
                </div>
                <Switch
                  id="goal-streak"
                  label="Streak counts only when the daily goal is met"
                  checked={prefs.goalBasedStreak}
                  onChange={(v) => savePref({ goalBasedStreak: v }, v ? 'Streak now needs the daily goal' : 'Any revision keeps the streak')}
                />
              </div>

              {/* Timezone */}
              <div>
                <label htmlFor="timezone" style={labelStyle}>Timezone</label>
                <select
                  id="timezone"
                  value={prefs.timezone ?? ''}
                  onChange={(e) => savePref({ timezone: e.target.value || null }, `Timezone: ${e.target.value || 'automatic'}`)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {!prefs.timezone && <option value="">Not set (UTC)</option>}
                  {tzOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                      {tz === detectedTz ? ' (this device)' : ''}
                    </option>
                  ))}
                </select>
                <span style={hintStyle}>
                  Decides when your day starts for streaks, &quot;due today&quot; and reminders.
                  {detectedTz && prefs.timezone !== detectedTz && (
                    <>
                      {' '}This device is on {detectedTz.replace(/_/g, ' ')}.{' '}
                      <button
                        type="button"
                        onClick={() => savePref({ timezone: detectedTz }, `Timezone: ${detectedTz}`)}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--info)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}
                      >
                        Use it
                      </button>
                    </>
                  )}
                </span>
              </div>

              {/* Theme */}
              <div>
                <span style={labelStyle}>Interface theme</span>
                <ThemeToggle variant="segmented" />
                <span style={hintStyle}>System follows your device&apos;s light or dark setting. Saved in this browser.</span>
              </div>

              <StatusText state={prefSave.state} style={{ marginTop: -8 }} />
            </div>
          </Card>

          {/* Review intervals */}
          <Card
            title="Review intervals"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          >
            <div style={{ maxWidth: 460 }}>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -6, marginBottom: 16, lineHeight: 1.5 }}>
                After each clean recall a problem moves to the next step. Set how many days each step waits.
                Changes apply to future reviews; problems already scheduled keep their current due date.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {ladderDraft.map((v, i) => (
                  <div key={i}>
                    <label htmlFor={`ladder-${i}`} style={{ ...labelStyle, fontSize: 11 }}>
                      Step {i + 1}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id={`ladder-${i}`}
                        type="number"
                        min={1}
                        max={365}
                        inputMode="numeric"
                        value={v}
                        aria-invalid={!!ladderValidation}
                        aria-describedby="ladder-hint"
                        onChange={(e) => {
                          const next = [...ladderDraft];
                          next[i] = e.target.value;
                          setLadderDraft(next);
                          ladderSave.reset();
                        }}
                        style={{ ...inputStyle, paddingRight: 34, fontFamily: 'var(--font-geist-mono), monospace' }}
                      />
                      <span aria-hidden="true" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-subtle)' }}>
                        d
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <span id="ladder-hint" style={{ ...hintStyle, color: ladderValidation && ladderDirty ? 'var(--error)' : 'var(--text-subtle)' }}>
                {ladderValidation && ladderDirty ? ladderValidation : 'Whole days from 1 to 365, each longer than the last.'}
              </span>
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <ActionButton onClick={saveLadder} disabled={!ladderDirty || !!ladderValidation || ladderSave.state.status === 'saving'}>
                  {ladderSave.state.status === 'saving' ? 'Saving…' : 'Save intervals'}
                </ActionButton>
                <ActionButton
                  onClick={resetLadder}
                  disabled={ladderSave.state.status === 'saving' || (prefs.ladderDays.join() === DEFAULT_LADDER.join() && !ladderDirty)}
                >
                  Reset to 3 / 7 / 14 / 30
                </ActionButton>
              </div>
              <StatusText state={ladderSave.state} />
            </div>
          </Card>

          {/* Reminders */}
          <Card
            title="Email reminders"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 11V7a4 4 0 1 1 8 0v4l1 1.5H3L4 11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M6.5 14a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            }
          >
            <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <label htmlFor="reminders-on" style={{ ...labelStyle, marginBottom: 2, color: 'var(--text-strong)' }}>
                    Daily reminder email
                  </label>
                  <span style={{ ...hintStyle, marginTop: 0 }}>
                    One email a day to {email}, only when you have reviews due.
                  </span>
                </div>
                <Switch
                  id="reminders-on"
                  label="Daily reminder email"
                  checked={prefs.remindersEnabled}
                  onChange={(v) => saveReminders({ remindersEnabled: v })}
                />
              </div>
              <div>
                <label htmlFor="reminder-hour" style={labelStyle}>Send at</label>
                <select
                  id="reminder-hour"
                  value={prefs.reminderHour}
                  disabled={!prefs.remindersEnabled}
                  onChange={(e) => saveReminders({ reminderHour: Number(e.target.value) })}
                  style={{ ...inputStyle, cursor: prefs.remindersEnabled ? 'pointer' : 'not-allowed', opacity: prefs.remindersEnabled ? 1 : 0.6 }}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
                <span style={hintStyle}>In your timezone ({effectiveTz.replace(/_/g, ' ')}).</span>
              </div>
              <StatusText state={reminderSave.state} style={{ marginTop: -8 }} />
            </div>
          </Card>

          <AccountSection onEmailChanged={setEmail} />

          {/* Data Export */}
          <Card
            title="Data Backup & Export"
            icon={
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13h10M8 2v8M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -12, marginBottom: 18, lineHeight: 1.5 }}>
              Import your existing problem list from CSV or Excel, or download a complete JSON export of all your tracked problems, custom notes, revisions, and daily streak logs.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ActionButton data-import-btn onClick={() => setShowImportModal(true)} style={{ fontSize: 12.5, padding: '9px 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Upload size={14} aria-hidden="true" style={{ color: 'var(--info)' }} />
                Import from CSV / Excel
              </ActionButton>

              <ActionButton
                data-export-btn
                onClick={() => {
                  window.location.href = '/api/export';
                }}
                style={{ fontSize: 12.5, padding: '9px 18px', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ color: 'var(--info)' }}>
                  <path d="M8 2v8M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Export All Data (.json)
              </ActionButton>
            </div>
          </Card>

          {/* Feedback & Issues */}
          <Card
            title="Feedback & Issues"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#F7981E' }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            }
          >
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: -12, marginBottom: 18, lineHeight: 1.5 }}>
              Help us improve {siteConfig.name} by reporting bugs, requesting new features, or sharing your interview prep feedback.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {siteConfig.githubUrl ? (
              <FeedbackLink href={`${siteConfig.githubUrl}/issues/new`}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                </svg>
                Create GitHub Issue ↗
              </FeedbackLink>
              ) : null}
              <FeedbackLink href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(`${siteConfig.name} feedback`)}`}>
                <Mail size={14} aria-hidden="true" style={{ color: 'var(--info)' }} />
                Email Feedback
              </FeedbackLink>
            </div>
          </Card>
        </div>
      )}

      {/* CSV / Excel Import modal */}
      {showImportModal && (
        <ImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(res) => {
            setImportToast(
              `Successfully imported ${res.imported} problems${res.skipped > 0 ? ` (${res.skipped} skipped)` : ''}`
            );
            setTimeout(() => setImportToast(null), 4000);
          }}
        />
      )}

      {/* Toast notification */}
      {importToast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            background: 'var(--popover)',
            border: '1px solid var(--popover-border)',
            borderRadius: 6,
            color: 'var(--text-strong)',
            fontSize: 13,
            padding: '10px 16px',
            boxShadow: 'var(--shadow-modal)',
          }}
        >
          {importToast}
        </div>
      )}
    </div>
  );
}

function FeedbackLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('http');
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        background: 'var(--settings-action-btn-bg)',
        border: '1px solid var(--settings-action-btn-border)',
        borderRadius: 6,
        color: 'var(--settings-action-btn-color)',
        fontSize: 12.5,
        fontWeight: 500,
        padding: '9px 18px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        textDecoration: 'none',
        boxShadow: 'var(--shadow-modal)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--settings-action-btn-hover-bg)';
        e.currentTarget.style.borderColor = 'var(--settings-action-btn-hover-border)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--settings-action-btn-bg)';
        e.currentTarget.style.borderColor = 'var(--settings-action-btn-border)';
      }}
    >
      {children}
    </a>
  );
}
