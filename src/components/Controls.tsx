export interface ControlsState {
  text: string;
  fontSize: number;
  fillEnabled: boolean;
  fillColor: string;
  burst: boolean;
  outline: boolean;
  mergeBoxes: boolean;
  mergeOverlap: number;
  pngScale: number;
}

interface Props extends ControlsState {
  maxChars: number;
  canExport: boolean;
  busy: boolean;
  onChange: <K extends keyof ControlsState>(key: K, value: ControlsState[K]) => void;
  onReroll: () => void;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onCopyPng: () => void;
}

export default function Controls(props: Props) {
  const {
    text,
    fontSize,
    fillEnabled,
    fillColor,
    burst,
    outline,
    mergeBoxes,
    mergeOverlap,
    pngScale,
    maxChars,
    canExport,
    busy,
    onChange,
  } = props;

  return (
    <div className="controls">
      <label className="field">
        <span className="field__label">
          Text <span className="field__count">{text.length}/{maxChars}</span>
        </span>
        <input
          className="field__input"
          type="text"
          value={text}
          maxLength={maxChars}
          placeholder="TAKE YOUR HEART"
          onChange={(e) => onChange('text', e.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Font size: {fontSize}px</span>
        <input
          type="range"
          min={24}
          max={140}
          value={fontSize}
          onChange={(e) => onChange('fontSize', Number(e.target.value))}
        />
      </label>

      <fieldset className="group">
        <legend>Background</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={fillEnabled}
            onChange={(e) => onChange('fillEnabled', e.target.checked)}
          />
          Solid color
        </label>
        {fillEnabled && (
          <div className="color-row">
            <input
              type="color"
              value={fillColor}
              onChange={(e) => onChange('fillColor', e.target.value)}
            />
            <input
              className="field__input field__input--hex"
              type="text"
              value={fillColor}
              onChange={(e) => onChange('fillColor', e.target.value)}
            />
          </div>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={burst}
            onChange={(e) => onChange('burst', e.target.checked)}
          />
          P5 burst rings
        </label>
      </fieldset>

      <fieldset className="group">
        <legend>Boxes</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={mergeBoxes}
            onChange={(e) => onChange('mergeBoxes', e.target.checked)}
          />
          Merge into one box
        </label>
        {mergeBoxes && (
          <label className="field">
            <span className="field__label">Box overlap: {Math.round(mergeOverlap * 100)}%</span>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.05}
              value={mergeOverlap}
              onChange={(e) => onChange('mergeOverlap', Number(e.target.value))}
            />
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={outline}
            onChange={(e) => onChange('outline', e.target.checked)}
          />
          White cut-paper outline
        </label>
      </fieldset>

      <button className="btn btn--primary" onClick={props.onReroll}>
        Re-roll layout
      </button>

      <fieldset className="group">
        <legend>Export</legend>
        <div className="export-row">
          <button className="btn" disabled={!canExport || busy} onClick={props.onDownloadSvg}>
            Download SVG
          </button>
          <button className="btn" disabled={!canExport || busy} onClick={props.onDownloadPng}>
            Download PNG
          </button>
          <button className="btn" disabled={!canExport || busy} onClick={props.onCopyPng}>
            Copy PNG
          </button>
        </div>
        <label className="field">
          <span className="field__label">PNG scale</span>
          <select value={pngScale} onChange={(e) => onChange('pngScale', Number(e.target.value))}>
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={4}>4x</option>
          </select>
        </label>
      </fieldset>
    </div>
  );
}
