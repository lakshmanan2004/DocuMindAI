const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Document, Extraction } = require('../src/models');

const METHOD_BLACKLIST = new Set([
  'calculated', 'derived', 'microscopic', 'colorimetric', 'electrical impedance',
  'copper tartrate to colour complex', 'azobilirubin chromophores', 'creatinine amidohydrolase',
  'urease, colorimetric', 'uricase', 'arsenazo iii', 'uv with p5p, ifcc', 'uv with p5p',
  'direct- ise', 'pta/mgcl2', 'sf cube cell analysis', 'god-pod', 'clia', 'chemiluminescence',
  'chromatography', 'spectrophotometry', 'turbidimetry', 'nephelometry', 'end of report'
]);

function cleanTestsTable(tests) {
  const cleaned = [];

  for (const t of tests) {
    if (!t || !t.test_name) continue;
    let name = t.test_name.trim();

    // 1. Filter out methods, reagents, and explanations
    const nameLower = name.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    if (METHOD_BLACKLIST.has(nameLower)) continue;
    if (nameLower.length > 60) continue; // Paragraphs
    if (/^(?:increased in|decreased in|interpretation|limitations|additional information|explanation|due to|all results|this test|mild to moderate|psa is|ige mediates|hba1c|total haemoglobin|in random)\b/i.test(name)) continue;
    if (/^(?:colorimetric|calculated|derived|microscopic|direct measured)\b/i.test(name)) continue;

    let val = t.value ? String(t.value).trim() : null;
    let unit = t.unit ? String(t.unit).trim() : null;
    let ref = t.reference_range ? String(t.reference_range).trim() : null;
    let flag = t.flag ? String(t.flag).trim() : null;

    if (flag && (flag.toLowerCase() === 'null' || METHOD_BLACKLIST.has(flag.toLowerCase()))) flag = null;
    if (unit && (unit.toLowerCase() === 'null' || unit === '0' || unit === 'Concentration' || unit === 'Area %')) unit = null;

    // 2. If value and ref are swapped (value has range "X - Y" or "< X" and ref is single number "14.5")
    const isRange = (s) => s && (/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/.test(s) || /^[<>=]\s*\d+/.test(s) || /^(?:normal|desirable|optimal|borderline)/i.test(s));
    const isSingleNumber = (s) => s && /^[0-9]+(?:\.[0-9]+)?$/.test(s.replace(/,/g, ''));

    if (isRange(val) && isSingleNumber(ref)) {
      const temp = val;
      val = ref;
      ref = temp;
    }

    // 3. Clean test name from trailing unit or flag
    name = name.replace(/\s+(?:mg\/dL|g\/dL|mmol\/L|ng\/mL|pg\/mL|microIU\/mL|million\/cmm|fL|pg|%|\/cmm|U\/L)\b/gi, '').trim();

    cleaned.push({
      test_name: name,
      value: val,
      unit,
      reference_range: ref,
      flag
    });
  }

  return cleaned;
}

async function testClean() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await Document.findOne({ originalName: /sterling/i });
  const ext = await Extraction.findOne({ documentId: doc._id });
  const testsField = ext.fields.find(f => f.key === 'tests');
  
  const cleaned = cleanTestsTable(testsField.value);
  console.log(`Cleaned from ${testsField.value.length} to ${cleaned.length} genuine tests:`);
  cleaned.forEach((t, i) => {
    console.log(`${i + 1}. [${t.test_name}] => val: "${t.value}", unit: "${t.unit}", ref: "${t.reference_range}", flag: "${t.flag}"`);
  });

  await mongoose.disconnect();
}

testClean().catch(console.error);

