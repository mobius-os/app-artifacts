export const CSS = `
/* mobius-ui:Root — app-owned. */
.af-root {
  position: relative;
  width: 100%;
  height: 100dvh;
  min-height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-kerning: normal;
  -webkit-font-smoothing: antialiased;
}
.af-view {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg);
}
.af-scroll,
.af-detail-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.af-page,
.af-detail-page {
  width: 100%;
  max-width: 74rem;
  margin-inline: auto;
  box-sizing: border-box;
}
.af-page { padding: 1rem 1rem max(2.5rem, env(safe-area-inset-bottom)); }
.af-detail-page { max-width: 62rem; padding: 0 1rem max(3rem, env(safe-area-inset-bottom)); }
/* /mobius-ui:Root */

/* mobius-ui:Header — app-owned. */
.af-header,
.af-detail-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  min-height: 4rem;
  padding: max(0.625rem, env(safe-area-inset-top)) 1rem 0.625rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.af-header { justify-content: space-between; }
.af-brand { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
.af-mark,
.af-card-icon,
.af-action-icon,
.af-sheet-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  background: var(--accent-dim);
  color: var(--accent);
}
.af-mark { width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; }
.af-brand-copy { min-width: 0; }
.af-brand-copy h1,
.af-detail-heading h1,
.af-sheet h2,
.af-empty-title {
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.af-brand-copy h1 { margin: 0; font-size: 1.125rem; line-height: 1.2; font-weight: 720; letter-spacing: -0.015em; }
.af-brand-copy p { margin: 0.125rem 0 0; color: var(--muted); font-size: 0.75rem; line-height: 1.25; }
.af-detail-header { gap: 0.5rem; }
.af-detail-heading { flex: 1; min-width: 0; text-align: center; }
.af-detail-heading h1 { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1rem; line-height: 1.25; font-weight: 680; }
.af-detail-heading span { display: block; margin-top: 0.125rem; color: var(--muted); font: 500 0.6875rem/1 var(--mono); }
/* /mobius-ui:Header */

.af-card-list { display: flex; flex-direction: column; gap: 0.75rem; }

/* mobius-ui:Card — app-owned. */
.af-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  min-height: 7rem;
  padding: 1rem;
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 0.875rem;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font);
  cursor: pointer;
  touch-action: manipulation;
  transition: border-color 160ms cubic-bezier(0.25, 1, 0.5, 1), background 160ms cubic-bezier(0.25, 1, 0.5, 1), transform 100ms cubic-bezier(0.25, 1, 0.5, 1);
}
.af-card:hover { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); background: color-mix(in srgb, var(--accent) 4%, var(--surface)); }
.af-card:active { transform: scale(0.992); }
.af-card-icon { width: 2.75rem; height: 2.75rem; border-radius: 0.75rem; }
.af-card-main { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 0.375rem; }
.af-card-topline { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.af-card-title { flex: 1; min-width: 0; font-size: 1rem; line-height: 1.3; font-weight: 680; overflow-wrap: anywhere; }
.af-card-description {
  display: -webkit-box;
  overflow: hidden;
  color: color-mix(in srgb, var(--text) 74%, var(--muted));
  font-size: 0.875rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.af-card-meta { display: flex; align-items: center; gap: 0.5rem; color: var(--muted); font-size: 0.75rem; line-height: 1.2; }
.af-card-chevron { display: inline-flex; color: var(--muted); opacity: 0.75; }
.af-card-skeleton { cursor: default; }
.af-skeleton-lines { display: flex; flex: 1; flex-direction: column; gap: 0.625rem; }
/* /mobius-ui:Card */

.af-chip,
.af-badge {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0.1875rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  line-height: 1;
  font-weight: 650;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.af-chip { background: var(--surface2); color: var(--muted); }
.af-badge-shared { background: color-mix(in srgb, var(--green) 13%, transparent); color: var(--green); }

/* mobius-ui:Button — app-owned. */
.af-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4375rem;
  min-height: 2.75rem;
  padding: 0.625rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.625rem;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font);
  font-size: 0.875rem;
  line-height: 1.2;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 140ms cubic-bezier(0.25, 1, 0.5, 1), border-color 140ms cubic-bezier(0.25, 1, 0.5, 1), transform 100ms cubic-bezier(0.25, 1, 0.5, 1), opacity 140ms ease;
}
.af-btn:hover { border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.af-btn:active { transform: scale(0.97); }
.af-btn:disabled { opacity: 0.5; cursor: default; transform: none; }
.af-btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.af-btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.af-btn-secondary { background: var(--surface2); }
.af-btn-ghost { background: transparent; border-color: transparent; }
.af-btn-ghost:hover { background: var(--accent-dim); border-color: transparent; }
.af-btn-danger { background: var(--danger); border-color: var(--danger); color: var(--accent-fg); }
.af-btn-danger-ghost { background: transparent; border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); color: var(--danger); }
.af-btn-danger-ghost:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); border-color: var(--danger); }
.af-btn-icon { width: 2.75rem; padding: 0; flex: 0 0 auto; }
.af-btn-block { width: 100%; box-sizing: border-box; }
/* /mobius-ui:Button */

/* mobius-ui:Empty — app-owned. */
.af-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  min-height: min(68dvh, 36rem);
  max-width: 28rem;
  margin-inline: auto;
  padding: 3rem 1.5rem;
  color: var(--muted);
  text-align: center;
}
.af-empty-compact { min-height: 55dvh; }
.af-empty-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: 1rem;
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 1.5rem;
  font-weight: 750;
}
.af-empty-mark.is-error { border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
.af-empty-title { margin: 0; color: var(--text); font-size: 1.125rem; line-height: 1.3; font-weight: 720; }
.af-empty-text { max-width: 38ch; margin: 0 0 0.875rem; font-size: 0.9375rem; line-height: 1.6; text-wrap: pretty; }
/* /mobius-ui:Empty */

.af-detail-loading { display: flex; height: 100%; flex-direction: column; gap: 1rem; padding: 1rem; background: var(--bg); }
.af-skeleton { min-height: 0.875rem; border-radius: 0.375rem; background: color-mix(in srgb, var(--muted) 16%, var(--surface2)); animation: af-pulse 1.5s ease-in-out infinite; }
.af-skeleton.is-short { width: 54%; }
.af-skeleton-icon { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; border-radius: 0.75rem; }
.af-skeleton-title { width: 42%; height: 1.5rem; }
.af-skeleton-window { width: 100%; height: 100%; min-height: 18rem; border-radius: 0; }
@keyframes af-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

.af-preview-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 55dvh;
  min-height: 20rem;
  max-height: 40rem;
  margin: 1rem 0 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 0.875rem;
  background: var(--surface);
}
.af-preview-shell.is-fullscreen {
  position: absolute;
  inset: 0;
  z-index: 120;
  width: auto;
  height: auto;
  min-height: 0;
  max-height: none;
  margin: 0;
  border: 0;
  border-radius: 0;
}
.af-preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 3rem;
  padding: 0.25rem 0.375rem 0.25rem 0.875rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  color: var(--muted);
  font: 550 0.75rem/1 var(--mono);
  font-variant-numeric: tabular-nums;
}
.af-preview-context { display: flex; min-width: 0; align-items: center; gap: 0.625rem; }
.af-preview-context > span { flex: 0 0 auto; }
.af-preview-tools { display: flex; align-items: center; gap: 0.125rem; }
.af-segment {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem;
  border: 1px solid var(--border);
  border-radius: 0.625rem;
  background: var(--surface);
}
.af-segment button {
  min-height: 2.75rem;
  padding: 0.5rem 0.75rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--muted);
  font: 650 0.8125rem/1 var(--font);
  cursor: pointer;
  touch-action: manipulation;
}
.af-segment button:hover { color: var(--text); }
.af-segment button.is-selected { background: var(--accent-dim); color: var(--accent); }
.af-preview-tool { border-color: transparent; background: transparent; color: var(--muted); }
.af-preview-tool:hover { background: var(--accent-dim); color: var(--text); }
.af-preview {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background: var(--bg);
}
.af-preview-frame { display: block; width: 100%; height: 100%; border: 0; background: var(--bg); }
.af-preview-loading { position: absolute; inset: 0; }
.af-source { flex: 1; min-height: 0; overflow: auto; background: var(--bg); }
.af-source pre {
  min-width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 1rem;
  color: var(--text);
  font: 500 0.75rem/1.55 var(--mono);
  tab-size: 2;
  white-space: pre;
}
.af-source code { font: inherit; }
.af-source-state { height: 100%; }
.af-preview-error {
  display: flex;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--muted);
  text-align: center;
}
.af-preview-error strong { color: var(--text); font-size: 1rem; }
.af-preview-error p { max-width: 42ch; margin: 0 0 0.625rem; font-size: 0.875rem; line-height: 1.5; }
.af-preview-error-mark { display: grid; place-items: center; width: 2.75rem; height: 2.75rem; margin-bottom: 0.25rem; border-radius: 50%; background: color-mix(in srgb, var(--danger) 11%, transparent); color: var(--danger); font-weight: 750; }

.af-detail-meta { padding: 1.25rem 0; border-bottom: 1px solid var(--border-light); }
.af-detail-description { max-width: 65ch; margin: 0 0 0.875rem; color: color-mix(in srgb, var(--text) 78%, var(--muted)); font-size: 1rem; line-height: 1.6; text-wrap: pretty; }
.af-meta-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.af-origin { margin: 0.75rem 0 0; color: var(--muted); font-size: 0.8125rem; line-height: 1.4; }
.af-origin strong { color: var(--text); font-weight: 620; }

.af-actions { display: flex; flex-direction: column; padding: 0.75rem 0; border-bottom: 1px solid var(--border-light); }
.af-action {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 4rem;
  padding: 0.625rem 0.25rem;
  border: 0;
  border-bottom: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  text-align: left;
  font-family: var(--font);
  cursor: pointer;
  touch-action: manipulation;
  transition: background 140ms cubic-bezier(0.25, 1, 0.5, 1), opacity 140ms ease;
}
.af-action:last-child { border-bottom: 0; }
.af-action:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.af-action:active { background: var(--accent-dim); }
.af-action.is-disabled { opacity: 0.55; cursor: default; }
.af-action-icon { width: 2.5rem; height: 2.5rem; border-radius: 0.6875rem; }
.af-action > span:last-child { display: flex; min-width: 0; flex-direction: column; gap: 0.1875rem; }
.af-action strong { font-size: 0.9375rem; line-height: 1.25; font-weight: 660; }
.af-action small { color: var(--muted); font-size: 0.75rem; line-height: 1.3; }

/* mobius-ui:Disclosure — app-owned. */
.af-disc { margin: 1.25rem 0 0; border: 1px solid var(--border); border-radius: 0.875rem; background: var(--surface); overflow: hidden; }
.af-disc > summary {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 3.25rem;
  padding: 0.5rem 0.875rem;
  list-style: none;
  color: var(--text);
  font-size: 0.9375rem;
  line-height: 1.2;
  font-weight: 660;
  cursor: pointer;
}
.af-disc > summary::-webkit-details-marker { display: none; }
.af-disc-count { display: inline-flex; align-items: center; justify-content: center; min-width: 1.5rem; min-height: 1.5rem; padding-inline: 0.25rem; border-radius: 999px; background: var(--surface2); color: var(--muted); font-size: 0.6875rem; font-variant-numeric: tabular-nums; }
.af-disc-chevron { margin-left: auto; color: var(--muted); transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); }
.af-disc[open] .af-disc-chevron { transform: rotate(180deg); }
.af-timeline { padding: 0 0.75rem 0.75rem; }
.af-version {
  display: flex;
  width: 100%;
  min-height: 4.5rem;
  padding: 0.625rem 0;
  border: 0;
  background: transparent;
  color: var(--text);
  text-align: left;
  font-family: var(--font);
  cursor: pointer;
}
.af-version:hover .af-version-content { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.af-version-rail { position: relative; display: flex; width: 2rem; justify-content: center; flex: 0 0 auto; }
.af-version-rail::after { position: absolute; top: 1.5rem; bottom: -1rem; width: 1px; background: var(--border); content: ""; }
.af-version:last-child .af-version-rail::after { display: none; }
.af-version-dot { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; border: 1px solid var(--border); border-radius: 50%; background: var(--surface); color: var(--accent-fg); }
.af-version.is-selected .af-version-dot { border-color: var(--accent); background: var(--accent); }
.af-version-content { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 0.25rem; margin-left: 0.25rem; padding: 0.125rem 0.5rem 0.5rem; border-radius: 0.5rem; transition: background 140ms ease; }
.af-version-title { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; line-height: 1.3; font-weight: 650; }
.af-version-note { color: color-mix(in srgb, var(--text) 76%, var(--muted)); font-size: 0.8125rem; line-height: 1.45; overflow-wrap: anywhere; }
.af-version-meta { color: var(--muted); font-size: 0.6875rem; line-height: 1.3; font-variant-numeric: tabular-nums; }
/* /mobius-ui:Disclosure */

/* mobius-ui:Sheet — app-owned. */
.af-scrim {
  position: absolute;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 1rem 1rem 0;
  background: color-mix(in srgb, var(--text) 48%, transparent);
  animation: af-fade-in 160ms cubic-bezier(0.25, 1, 0.5, 1);
}
.af-sheet {
  width: 100%;
  max-width: 30rem;
  max-height: min(88dvh, 44rem);
  box-sizing: border-box;
  overflow-y: auto;
  padding: 0.625rem 1.25rem max(1.25rem, env(safe-area-inset-bottom));
  border: 1px solid var(--border);
  border-bottom: 0;
  border-radius: 1rem 1rem 0 0;
  background: var(--surface);
  color: var(--text);
  animation: af-sheet-in 190ms cubic-bezier(0.16, 1, 0.3, 1);
}
.af-sheet-handle { width: 2.25rem; height: 0.25rem; margin: 0 auto 1rem; border-radius: 999px; background: var(--border); }
.af-sheet h2 { margin: 0; font-size: 1.0625rem; line-height: 1.3; font-weight: 720; letter-spacing: -0.01em; }
.af-sheet-heading { display: flex; align-items: flex-start; gap: 0.75rem; }
.af-sheet-heading p,
.af-sheet-copy { margin: 0.375rem 0 0; color: var(--muted); font-size: 0.875rem; line-height: 1.5; text-wrap: pretty; }
.af-sheet-icon { width: 2.5rem; height: 2.5rem; border-radius: 0.6875rem; }
.af-share-url { display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0 0.625rem; padding: 0.375rem 0.375rem 0.375rem 0.75rem; border: 1px solid var(--border); border-radius: 0.625rem; background: var(--surface2); }
.af-share-url span { flex: 1; min-width: 0; overflow: hidden; color: var(--text); font: 500 0.75rem/1.4 var(--mono); text-overflow: ellipsis; white-space: nowrap; }
.af-sheet-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem; }
.af-sheet-actions > .af-btn { flex: 1; }
.af-sheet-actions.is-stacked { flex-direction: column; }
.af-sheet-actions.is-stacked > .af-btn { flex: none; }
.af-option-list { display: flex; flex-direction: column; margin-top: 0.75rem; }
.af-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 4rem;
  padding: 0.625rem 0;
  border: 0;
  border-bottom: 1px solid var(--border-light);
  background: transparent;
  color: var(--text);
  text-align: left;
  font-family: var(--font);
  cursor: pointer;
  touch-action: manipulation;
}
.af-option:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.af-option:disabled { opacity: 0.5; cursor: default; }
.af-option:last-child { border-bottom: 0; }
.af-option > span:last-child { display: flex; min-width: 0; flex-direction: column; gap: 0.1875rem; }
.af-option strong { font-size: 0.9375rem; line-height: 1.3; font-weight: 660; }
.af-option small { color: var(--muted); font-size: 0.75rem; line-height: 1.35; }
.af-option-icon { display: inline-flex; align-items: center; justify-content: center; width: 2.75rem; height: 2.75rem; flex: 0 0 auto; border-radius: 0.6875rem; background: var(--surface2); color: var(--accent); }
.af-option.is-danger { color: var(--danger); }
.af-option.is-danger .af-option-icon { background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); }
@keyframes af-fade-in { from { opacity: 0; } }
@keyframes af-sheet-in { from { opacity: 0.75; transform: translateY(1.5rem); } }
/* /mobius-ui:Sheet */

/* mobius-ui:Toast — app-owned. */
.af-toast {
  position: absolute;
  left: 1rem;
  right: 1rem;
  bottom: max(1rem, env(safe-area-inset-bottom));
  z-index: 200;
  max-width: 34rem;
  margin-inline: auto;
  padding: 0.75rem 1rem;
  border: 1px solid var(--accent);
  border-radius: 0.75rem;
  background: var(--surface);
  color: var(--text);
  font-size: 0.875rem;
  line-height: 1.4;
  animation: af-toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.af-toast.is-success { border-color: var(--green); }
.af-toast.is-error { border-color: var(--danger); }
@keyframes af-toast-in { from { opacity: 0; transform: translateY(0.5rem); } }
/* /mobius-ui:Toast */

/* mobius-ui:Focus — app-owned. */
:where(.af-root button, .af-root a, .af-root summary, .af-root [role="button"]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
/* /mobius-ui:Focus */

@media (min-width: 44rem) {
  .af-page { padding: 1.5rem 1.5rem 3rem; }
  .af-card-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
  .af-detail-page { padding-inline: 1.5rem; }
  .af-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; padding-block: 1rem; }
  .af-action { align-items: flex-start; min-height: 7.25rem; padding: 0.875rem; border: 1px solid var(--border); border-radius: 0.75rem; }
  .af-action:last-child { border-bottom: 1px solid var(--border); }
}

@media (max-height: 36rem) {
  .af-preview-shell { height: 50dvh; min-height: 15rem; }
}

@media (max-width: 29rem) {
  .af-preview-toolbar { align-items: stretch; flex-direction: column; padding: 0.375rem; }
  .af-preview-context { justify-content: space-between; }
  .af-preview-tools { justify-content: flex-end; }
}

/* mobius-ui:ReducedMotion — app-owned. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
/* /mobius-ui:ReducedMotion */
`
