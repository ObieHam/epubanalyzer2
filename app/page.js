'use client';
import { useState } from 'react';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [status, setStatus] = useState(""); // Detailed status
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setCharacters([]);
    setStatus("Uploading and reading file...");

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Server error");
      }

      const data = await res.json();
      setCharacters(data.characters);
      setStatus(data.characters.length > 0 ? "Analysis Complete!" : "No characters found. Try a different book.");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}. (Check if the book is very large)`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans">
      <div className="bg-slate-900 text-white p-8 rounded-2xl mb-8 shadow-xl">
        <h1 className="text-3xl font-bold">Character Navigator</h1>
        <p className="opacity-70 mt-2">Upload an EPUB to identify characters using linguistic patterns.</p>
        
        <input 
          type="file" accept=".epub" onChange={handleUpload}
          className="mt-6 block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-500 file:text-white hover:file:bg-blue-600 cursor-pointer"
        />
        
        {status && (
          <div className={`mt-4 p-3 rounded-lg text-sm font-mono ${status.includes('Error') ? 'bg-red-900/50 text-red-200' : 'bg-blue-900/50 text-blue-200'}`}>
            {loading && <span className="animate-pulse mr-2">●</span>}
            {status}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map((char, i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-lg text-slate-800">{char.name}</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              {char.traits.map((t, j) => (
                <span key={j} className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded">
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
