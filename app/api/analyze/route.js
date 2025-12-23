import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);
const its = nlp.its;

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);

    const containerEntry = zip.getEntry('META-INF/container.xml');
    const containerXml = containerEntry.getData().toString();
    const containerObj = await parseStringPromise(containerXml);
    const opfPath = containerObj.container.rootfiles[0].rootfile[0].$['full-path'];
    
    let fullText = "";
    const zipEntries = zip.getEntries();
    // Processing first 15 chapters for better depth
    const htmlFiles = zipEntries.filter(e => e.entryName.endsWith('.xhtml') || e.entryName.endsWith('.html')).slice(0, 15);

    htmlFiles.forEach((entry) => {
      const html = entry.getData().toString();
      const text = html.replace(/<[^>]*>/g, ' '); 
      fullText += text + " ";
    });

    // --- CUSTOM NLP CONFIGURATION ---
    // Define relationship terms to track
    const relationships = [
      'wife', 'husband', 'mother', 'mom', 'father', 'dad', 
      'sister', 'brother', 'daughter', 'son', 'grandmother', 'grandfather',
      'aunt', 'uncle', 'cousin', 'fiance', 'fiancé'
    ];

    const doc = nlp.readDoc(fullText);
    const characters = {};

    // 1. Extract Proper Names (Standard NER)
    doc.entities().filter(e => e.out(its.type) === 'PERSON').each((e) => {
      const name = e.out().trim();
      if (name.length > 2) {
        if (!characters[name]) characters[name] = { name, traits: new Set(), count: 0 };
        characters[name].count++;
      }
    });

    // 2. Extract Relationship Characters
    // We look for "my [term]" or "[term]" appearing as a subject
    doc.tokens().each((token) => {
      const word = token.out().toLowerCase();
      if (relationships.includes(word)) {
        const displayName = `The ${word.charAt(0).toUpperCase() + word.slice(1)}`;
        if (!characters[displayName]) {
          characters[displayName] = { name: displayName, traits: new Set(), count: 0 };
        }
        characters[displayName].count++;
      }
    });

    // 3. Extract Traits (Broad Adjective Mapping)
    doc.sentences().each((sent) => {
      const tokens = sent.tokens().out(its.value);
      const lowerTokens = tokens.map(t => t.toLowerCase());
      const pos = sent.tokens().out(its.pos);

      Object.keys(characters).forEach(name => {
        const searchTerms = name.toLowerCase().split(' '); // e.g. "The Wife" -> ["the", "wife"]
        
        // Check if any part of the name/title is in this sentence
        const foundMatch = searchTerms.some(term => term.length > 2 && lowerTokens.includes(term));

        if (foundMatch) {
          sent.tokens().filter(t => t.out(its.pos) === 'ADJ').each(adj => {
            const trait = adj.out().toLowerCase();
            const noise = ['other', 'many', 'more', 'same', 'such', 'little', 'own', 'new', 'old'];
            if (trait.length > 3 && !noise.includes(trait)) {
              characters[name].traits.add(trait);
            }
          });
        }
      });
    });

    const result = Object.values(characters)
      .filter(c => c.count > 1 && c.traits.size > 0)
      .map(c => ({
        name: c.name,
        traits: Array.from(c.traits).slice(0, 8)
      }))
      .sort((a, b) => b.traits.length - a.traits.length)
      .slice(0, 20);

    return NextResponse.json({ characters: result });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
