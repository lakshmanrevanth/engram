'use client';

// Hidden on small screens, where rows render as stacked cards (see daily-styles.tsx).
export function NotionTableHeader() {
  return (
    <div
      className="rc-daily-grid rc-daily-head"
      aria-hidden="true"
      style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--daily-card-border)',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        userSelect: 'none',
      }}
    >
      <div>#</div>
      <div>Problem Title</div>
      <div>Difficulty</div>
      <div>Topic</div>
      <div>Confidence Rating</div>
      <div style={{ textAlign: 'right' }}>Link</div>
    </div>
  );
}
