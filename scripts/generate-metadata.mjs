import fs from 'node:fs';
import path from 'node:path';

const pinataCidAa = process.env.PINATA_AA_CID || 'bafybeialqnbl4agtpqai6pwornzom5vnf2566ewa35btlmmlqp5ccbtn6e';
const pinataCidPr = process.env.PINATA_PR_CID || 'bafybeiekl33n6ggbgm5yokbyclrm7c2kijxdeou4tuhibhpmapoj5yqzeq';
const outputRoot = path.resolve(process.cwd(), 'metadata');

const variants = [
  {
    folder: 'vc_al_aa',
    prefix: 'aa',
    label: 'AA',
    colorLabel: 'Azul Aurora',
    descriptionColor: 'Azul Aurora',
    count: 25,
    cid: pinataCidAa,
  },
  {
    folder: 'vc_al_pr',
    prefix: 'pr',
    label: 'PR',
    colorLabel: 'Preto',
    descriptionColor: 'Preto',
    count: 25,
    cid: pinataCidPr,
  },
];

for (const variant of variants) {
  const folderPath = path.join(outputRoot, variant.folder);
  fs.mkdirSync(folderPath, { recursive: true });

  for (let i = 1; i <= variant.count; i += 1) {
    const edition = String(i).padStart(3, '0');
    const fullSerial = `VR-AL-${variant.label}-01${edition}`;
    const fileName = `${variant.prefix}${String(i).padStart(2, '0')}.json`;
    const imagePath = `ipfs://${variant.cid}/${variant.prefix}${String(i).padStart(2, '0')}.jpg`;
    const modelName = 'Alvorada';
    const editionValue = `${i}/25`;

    const metadata = {
      name: `Vera Cruz Alvorada ${variant.colorLabel} #${editionValue}`,
      description: `Vera Cruz Alvorada watch - ${variant.descriptionColor} dial, 40mm, 316L Stainless Steel, Sapphire Crystal, Miyota 2115 Quartz movement. Serial: ${fullSerial}`,
      image: imagePath,
      external_url: 'https://www.relogiosveracruz.com.br/',
      attributes: [
        { trait_type: 'Model', value: modelName },
        { trait_type: 'Brand', value: 'Vera Cruz' },
        { trait_type: 'Case Material', value: '316L Stainless Steel' },
        { trait_type: 'Case Color', value: 'Prata' },
        { trait_type: 'Case Diameter', value: '40mm' },
        { trait_type: 'Crystal', value: 'Sapphire Crystal' },
        { trait_type: 'Bezel', value: 'Sem bezel' },
        { trait_type: 'Watch Style', value: 'Tres ponteiros com data' },
        { trait_type: 'Movement', value: 'Quartz' },
        { trait_type: 'Caliber', value: 'Miyota 2115' },
        { trait_type: 'Strap', value: 'Solid Stainless Steel President Style' },
        { trait_type: 'Strap Color', value: 'Prata' },
        { trait_type: 'Strap Material', value: 'Aco' },
        { trait_type: 'Strap Type', value: 'President' },
        { trait_type: 'Clasp', value: 'Borboleta' },
        { trait_type: 'Water Resistance', value: '5 ATM' },
        { trait_type: 'Dial Color', value: variant.colorLabel },
        { trait_type: 'Edition', value: editionValue },
        { trait_type: 'Power Reserve', value: 'N/A (Quartz)' },
        { trait_type: 'Serial Number', value: fullSerial },
      ],
    };

    fs.writeFileSync(
      path.join(folderPath, fileName),
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf8'
    );
  }
}

console.log(`Generated metadata for ${variants.reduce((total, variant) => total + variant.count, 0)} items under ${outputRoot}`);
console.log('AA CID:', pinataCidAa);
console.log('PR CID:', pinataCidPr);
