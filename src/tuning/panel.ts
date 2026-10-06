import './panel.css';
import { saveTuning } from './storage';
import { cloneDefaults, tuningSpecs, type Tuning } from './tuning';

const decimals = (step: number) => Math.max(0, -Math.floor(Math.log10(step)));

/** Dev panel with a slider per tuning value. Toggled with the backquote key. Edits `tuning` in place. */
export function createTuningPanel(tuning: Tuning, doc: Document = document): void {
  const panel = doc.createElement('div');
  panel.className = 'tuning-panel';
  panel.hidden = true;
  panel.innerHTML = `
    <strong>Tuning</strong> <span style="color:#8fa3b5">(\` to close)</span>
    <div class="tuning-buttons"><button data-act="reset">Reset</button><button data-act="copy">Copy as JSON</button></div>
    <div class="tuning-status"></div>`;
  const status = panel.querySelector<HTMLElement>('.tuning-status')!;
  const syncers: (() => void)[] = [];

  let group = '';
  for (const s of tuningSpecs) {
    if (s.group !== group) {
      group = s.group;
      const h = doc.createElement('h3');
      h.textContent = group;
      panel.append(h);
    }
    const row = doc.createElement('label');
    row.className = 'tuning-row';
    const name = doc.createElement('span');
    name.textContent = s.label;
    const out = doc.createElement('output');
    const slider = doc.createElement('input');
    slider.type = 'range';
    slider.min = String(s.min);
    slider.max = String(s.max);
    slider.step = String(s.step);
    const sync = () => {
      slider.value = String(tuning[s.key]);
      out.textContent = tuning[s.key].toFixed(decimals(s.step));
    };
    slider.addEventListener('input', () => {
      tuning[s.key] = Number(slider.value);
      out.textContent = tuning[s.key].toFixed(decimals(s.step));
      saveTuning(tuning);
    });
    sync();
    syncers.push(sync);
    row.append(name, out, slider);
    panel.append(row);
  }

  panel.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).dataset.act;
    if (act === 'reset') {
      Object.assign(tuning, cloneDefaults());
      saveTuning(tuning);
      syncers.forEach((f) => f());
      status.textContent = 'Reset to defaults';
    } else if (act === 'copy') {
      const json = JSON.stringify(tuning, null, 2);
      navigator.clipboard
        .writeText(json)
        .then(() => (status.textContent = 'Copied to clipboard'))
        .catch(() => window.prompt('Copy the tuning JSON:', json));
    }
  });

  doc.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote') return;
    e.preventDefault();
    panel.hidden = !panel.hidden;
    status.textContent = '';
    if (panel.hidden && doc.activeElement instanceof HTMLElement) doc.activeElement.blur();
  });

  doc.body.append(panel);
}
