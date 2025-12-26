import React from 'react';

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini (default)' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
];

type Props = {
  model: string;
  setModel: (m: string) => void;
};

export function ModelSelector({ model, setModel }: Props) {
  const isValid = MODEL_OPTIONS.some((m) => m.value === model);
  const safeValue = isValid ? model : 'gpt-4o-mini';

  return (
    <select
      value={safeValue}
      onChange={(e) => setModel(e.target.value)}
      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #3a3f47', background: '#0f172a', color: '#e5e7eb' }}
    >
      {MODEL_OPTIONS.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
export default ModelSelector;