import React from "react";

export const MODEL_OPTIONS = [
  { value: "gpt-5.2-pro", label: "gpt-5.2-pro (default)" },
  { value: "gpt-5.2", label: "gpt-5.2" },
  { value: "gpt-5 mini", label: "gpt-5 mini" },
  { value: "gpt-5", label: "gpt-5" },
  { value: "gpt-4o", label: "gpt-4o" },
  { value: "gpt-realtime", label: "gpt-realtime" },
  { value: "gpt-image-1.5", label: "gpt-image-1.5" },
  { value: "gpt-oss-120b", label: "gpt-oss-120b" },
  { value: "gpt-4o-transcribe-diarize", label: "gpt-4o-transcribe-diarize" },
];

type Props = {
  model: string;
  setModel: (m: string) => void;
  allowCustom?: boolean;
  setAllowCustom?: (b: boolean) => void;
};

export function ModelSelector({ model, setModel, allowCustom = false, setAllowCustom }: Props) {
  const isKnown = MODEL_OPTIONS.some((m) => m.value === model);
  const selectValue = isKnown ? model : allowCustom ? "__custom" : MODEL_OPTIONS[0].value;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "__custom") return; // keep current custom text from input
    setModel(value);
  };

  return (
    <div className="model-selector">
      <select value={selectValue} onChange={handleSelectChange} className="model-select">
        {MODEL_OPTIONS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
        {allowCustom && <option value="__custom">Custom…</option>}
      </select>

      {setAllowCustom && (
        <label className="model-toggle">
          <input
            type="checkbox"
            checked={allowCustom}
            onChange={(e) => setAllowCustom(e.target.checked)}
          />
          Allow custom
        </label>
      )}

      {allowCustom && (
        <input
          className="model-input"
          placeholder="Custom model id"
          value={model}
          onChange={(e) => setModel(e.target.value)}
        />
      )}

      {allowCustom && !isKnown && model && (
        <div className="model-warning">Warning: unverified model; may fail with model_not_found</div>
      )}
    </div>
  );
}
export default ModelSelector;