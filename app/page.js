'use client';
import { useState } from 'react';

export default function Home() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCharacters(data.characters);
    } catch (err) {
      setError("Failed to analyze. The book might be too large for Vercel's 10s limit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      <header className="mb-12 border-b pb-6">
        <h1 className="text-4xl font-extrabold text-slate-900">Character Navigator</h1>
        <p className="text-slate-500 mt-2">Upload an EPUB to extract character profiles using Classical NLP.</p>
      </header>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 mb-10 text-center">
        <label className="block text-sm font-medium text-slate-700 mb-4">Select EPUB File</label>
        <input 
          type="file" accept=".epub" onChange={handleUpload}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {loading && <div className="mt-4 text-blue-600 animate-pulse font-medium">Analyzing linguistic patterns...</div>}
        {error && <div className="mt-4 text-red-600 text-sm">{error}</div>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {characters.map((char, i) => (
          <div key={i} className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-xl font-bold text-slate-800 mb-3">{char.name}</h2>
            <div className="flex flex-wrap gap-2">
              {char.traits.map((trait, j) => (
                <span key={j} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-full capitalize">
                  {trait}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
