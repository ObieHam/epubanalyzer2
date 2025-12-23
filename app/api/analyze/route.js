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
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);

    // 1. Locate the OPF file to find the book structure
    const containerEntry = zip.getEntry('META-INF/container.xml');
    const containerXml = containerEntry.getData().toString();
    const containerObj = await parseStringPromise(containerXml);
    const opfPath = containerObj.container.rootfiles[0].rootfile[0].$['full-path'];
    
    // 2. Extract text from all XHTML/HTML chapters
    let fullText = "";
    const zipEntries = zip.getEntries();
    zipEntries.forEach((entry) => {
      if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
        const html = entry.getData().toString();
        const text = html.replace(/<[^>]*>/g, ' '); // Basic HTML strip
        fullText += text + " ";
      }
    });

    // 3. Process with Classical NLP
    const doc = nlp.readDoc(fullText);
    const characters = {};

    // Extract Entities labeled as PERSON
    doc.entities().filter(e => e.out(its.type) === 'PERSON').each((e) => {
      const name = e.out().trim();
      if (name.length > 2 && !name.includes('\n')) {
        if (!characters[name]) {
          characters[name] = { name, traits: new Set(), count: 0 };
        }
        characters[name].count++;
      }
    });

    // 4. Pattern Matching for Physical Descriptions
    // Looking for Name + Adjective or Sentences containing Name + Adjectives
    doc.sentences().each((sent) => {
      const sentText = sent.out();
      Object.keys(characters).forEach(name => {
        if (sentText.includes(name)) {
          sent.tokens().filter(t => t.out(its.pos) === 'ADJ').each(adj => {
            const trait = adj.out().toLowerCase();
            if (trait.length > 3) characters[name].traits.add(trait);
          });
        }
      });
    });

    // 5. Filter and Format (Only show characters mentioned multiple times)
    const result = Object.values(characters)
      .filter(c => c.count > 2 && c.traits.size > 0)
      .map(c => ({
        name: c.name,
        traits: Array.from(c.traits).slice(0, 6)
      }))
      .sort((a, b) => b.traits.length - a.traits.length);

    return NextResponse.json({ characters: result });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
