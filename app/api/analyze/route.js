import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

const nlp = winkNLP(model);
const its = nlp.its;

export async function POST(req) {
  console.log("--- Starting Analysis ---");
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file) throw new Error("No file found in request");

    console.log(`File received: ${file.name} (${file.size} bytes)`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);

    // 1. Find the OPF file
    console.log("Step 1: Finding OPF...");
    const containerEntry = zip.getEntry('META-INF/container.xml');
    if (!containerEntry) throw new Error("Invalid EPUB: Missing container.xml");
    
    const containerXml = containerEntry.getData().toString();
    const containerObj = await parseStringPromise(containerXml);
    const opfPath = containerObj.container.rootfiles[0].rootfile[0].$['full-path'];
    console.log(`OPF found at: ${opfPath}`);

    // 2. Extract text
    console.log("Step 2: Extracting text from chapters...");
    let fullText = "";
    const zipEntries = zip.getEntries();
    let chapterCount = 0;

    zipEntries.forEach((entry) => {
      if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
        const html = entry.getData().toString();
        const text = html.replace(/<[^>]*>/g, ' '); 
        fullText += text + " ";
        chapterCount++;
      }
    });
    console.log(`Extracted text from ${chapterCount} chapters. Total length: ${fullText.length} chars.`);

    if (fullText.length < 100) throw new Error("Book seems empty or protected by DRM.");

    // 3. Process with NLP
    console.log("Step 3: Running NLP Analysis (this is the heavy part)...");
    const doc = nlp.readDoc(fullText);
    const characters = {};

    doc.entities().filter(e => e.out(its.type) === 'PERSON').each((e) => {
      const name = e.out().trim();
      if (name.length > 2) {
        if (!characters[name]) characters[name] = { name, traits: new Set(), count: 0 };
        characters[name].count++;
      }
    });

    // Rule-based description
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

    const result = Object.values(characters)
      .filter(c => c.count > 1 && c.traits.size > 0)
      .map(c => ({ name: c.name, traits: Array.from(c.traits).slice(0, 5) }));

    console.log(`Analysis complete. Found ${result.length} characters.`);
    return NextResponse.json({ characters: result });

  } catch (error) {
    console.error("ANALYSIS ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
