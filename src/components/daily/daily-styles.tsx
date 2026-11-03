// Layout rules for the daily table, scoped by rc-* class names. Rendered once by the daily page.
// Under 768px rows become stacked cards: title + chips on top, rating buttons full width below.

export const DAILY_GRID_COLUMNS = '70px minmax(180px, 1fr) 95px 125px 290px 60px';

const CSS = `
.rc-daily-grid {
  display: grid;
  grid-template-columns: ${DAILY_GRID_COLUMNS};
  align-items: center;
  padding: 0 16px;
}
.rc-cell-chips { display: contents; }
.rc-cell-title { min-width: 0; }
.rc-daily-row { min-height: 48px; cursor: default; }
.rc-daily-row[data-expandable="true"] { cursor: pointer; }
.rc-daily-row:focus-visible { outline: 2px solid var(--focus-ring) !important; outline-offset: -2px !important; }
.rc-recall-panel { padding: 12px 16px 14px 102px; }
.rc-kbd {
  display: inline-block; min-width: 18px; padding: 1px 6px; border-radius: 4px; text-align: center;
  background: var(--input-bg); border: 1px solid var(--input-border); color: var(--text-normal);
  font-family: var(--font-geist-mono), monospace; font-size: 11px; line-height: 1.5;
}
.rc-toast-region {
  position: fixed; right: 24px; bottom: 24px; z-index: 9999;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  width: min(420px, calc(100vw - 32px)); pointer-events: none;
}
.rc-toast-region > * { pointer-events: auto; width: 100%; }
@keyframes rc-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
@media (max-width: 768px) {
  .rc-daily-head { display: none !important; }
  .rc-daily-grid {
    grid-template-columns: auto minmax(0, 1fr) auto !important;
    grid-template-areas: "id title more" "chips chips chips" "rate rate rate";
    height: auto !important;
    padding: 12px !important;
    row-gap: 8px; column-gap: 8px;
  }
  .rc-cell-id { grid-area: id; }
  .rc-cell-title { grid-area: title; padding-right: 0 !important; flex-wrap: wrap; }
  .rc-cell-title .rc-title { white-space: normal !important; }
  .rc-cell-more { grid-area: more; }
  .rc-cell-chips { grid-area: chips; display: flex !important; flex-wrap: wrap; gap: 6px; }
  .rc-cell-rate { grid-area: rate; }
  .rc-rate-buttons { width: 100%; flex-wrap: wrap; }
  .rc-rate-buttons > button { flex: 1 1 0; justify-content: center; min-height: 40px; }
  .rc-recall-panel { padding: 0 12px 14px !important; }
  .rc-toast-region { left: 16px; right: 16px; bottom: 16px; width: auto; align-items: stretch; }
  .rc-daily-toolbar { flex-wrap: wrap; }
}
`;

export function DailyStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
