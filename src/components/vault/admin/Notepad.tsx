import { useEffect, useState } from 'react';

export default function Notepad() {
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem('notepadText') || '';
    } catch (error) {
      console.error('Failed to retrieve from localStorage:', error);
      return '';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('notepadText', text);
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [text]);

  return (
    <div className="border border-zinc-300 bg-white p-6 rounded-xl flex flex-col gap-3">
      <h1>Notepad</h1>
      <textarea
        className="w-full h-64 p-3 bg-zinc-100 border border-zinc-300 rounded-lg resize-y"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your notes here..."
      />
    </div>
  );
}
