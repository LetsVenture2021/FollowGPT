import React from 'react';
import './world-clock.css';

const zones = [
  { label: 'Local', tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  { label: 'UTC', tz: 'UTC' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Bangalore', tz: 'Asia/Kolkata' },
];

function fmt(tz: string) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: tz,
  }).format(new Date());
}

export default function WorldClock() {
  return (
    <div className="world-clock">
      <div className="wc-title">World Clock</div>
      <div className="wc-grid">
        {zones.map((z) => (
          <div key={z.tz} className="wc-card">
            <div className="wc-label">{z.label}</div>
            <div className="wc-time">{fmt(z.tz)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}