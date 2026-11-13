const sharp = require('sharp');

async function checkMeta() {
  const meta = await sharp('c:/Users/AD-LAB/Projects/DocuMindAI/server/uploads/doc-1794565861543-5fd9305371626107.png').metadata();
  console.log('Image metadata:', meta);
}

checkMeta().catch(console.error);

