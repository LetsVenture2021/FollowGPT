import { useEffect, useMemo, useState } from 'react';
import './App.css';

type Msg = { role: 'user' | 'assistant'; content: string };

const sendChat = async (messages: Msg[], apiKey: string, model = 'gpt-4o-mini') => {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, stream: false })
  });
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
};

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('OPENAI_KEY') || '');
  const [model, setModel] = useState(localStorage.getItem('OPENAI_MODEL') || 'gpt-4o-mini');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (import.meta.env.VITE_OPENAI_API_KEY && !apiKey) {
      setApiKey(import.meta.env.VITE_OPENAI_API_KEY);
    }
    if (import.meta.env.VITE_OPENAI_MODEL && !model) {
      setModel(import.meta.env.VITE_OPENAI_MODEL);
    }
  }, []);

  const onSend = async () => {
    if (!input.trim() || !apiKey) return;
    const userMsg: Msg = { role: 'user', content: input };
    setMessages((m) => [...m, userMsg, { role: 'assistant', content: '…' }]);
    setInput('');
    setLoading(true);
    try {
      localStorage.setItem('OPENAI_KEY', apiKey);
      localStorage.setItem('OPENAI_MODEL', model);
      const res = await sendChat([...messages, userMsg], apiKey, model);
      const text = res.choices?.[0]?.message?.content ?? '';
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: text }]);
    } catch (e: any) {
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const disabled = loading || !apiKey;

  return (
    <div className="app">
      <header className="topbar">
        <div>Personal ChatGPT</div>
        <div className="inputs">
          <input type="password" value={apiKey} onChange={(e)=>setApiKey(e.target.value)} placeholder="OpenAI API key" />
          <input value={model} onChange={(e)=>setModel(e.target.value)} placeholder="Model (e.g., gpt-4o-mini)" />
        </div>
      </header>
      <main className="chat">
        <div className="messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="role">{m.role}</div>
              <div className="bubble">{m.content}</div>
            </div>
          ))}
        </div>
        <div className="composer">
          <textarea
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            placeholder="Ask anything..."
            onKeyDown={(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key==='Enter') onSend(); }}
          />
          <button onClick={onSend} disabled={disabled}>{loading ? '…' : 'Send'}</button>
        </div>
      </main>
    </div>
  );
}