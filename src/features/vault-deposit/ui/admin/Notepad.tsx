import { useEffect, useState } from 'react';

export function Notepad() {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem('notepadText') || '';
    } catch {
      // Silent error handling
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('notepadText', text);
    } catch {
      // Silent error handling
    }
  }, [text]);

  return (
    <div className="border border-line bg-surface-base text-fg-primary p-6 flex flex-col gap-3">
      <h1>Notepad</h1>
      <textarea
        className="w-full h-64 p-3 bg-surface-sunken border border-line text-fg-primary placeholder:text-fg-tertiary resize-y outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your notes here..."
      />
    </div>
  );
}
