import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ids = [
  'AfflictionWarlock', 'ArcaneMage', 'ArmsWarrior', 'Rogue', 'AugmentationEvoker',
  'BalanceDruid', 'BearDruid', 'BeastMasteryHunter', 'BloodDK', 'BrewmasterMonk',
  'CatDruid', 'DemonologyWarlock', 'DestructionWarlock', 'DevastationEvoker',
  'DisciplinePriest', 'ElementalShaman', 'EnhancementShaman', 'FireMage', 'FrostDK',
  'FrostMage', 'FuryWarrior', 'HavocDH', 'HolyPaladin', 'HolyPriest', 'MarksmanshipHunter',
  'Mistweaver', 'OutlawRogue', 'PreservationEvoker', 'ProtectionPaladin', 'ProtectionWarrior',
  'RestorationDruid', 'RestorationShaman', 'RetributionPaladin', 'ShadowPriest',
  'SubtletyRogue', 'SurvivalHunter', 'UnholyDK', 'VengeanceDH', 'WindwalkerMonk',
];

const LABEL_OVERRIDE = {
  Rogue: 'Assassination Rogue',
  Mistweaver: 'Mistweaver Monk',
  BloodDK: 'Blood Death Knight',
  FrostDK: 'Frost Death Knight',
  UnholyDK: 'Unholy Death Knight',
  HavocDH: 'Havoc Demon Hunter',
  VengeanceDH: 'Vengeance Demon Hunter',
};

function label(id) {
  if (LABEL_OVERRIDE[id]) return LABEL_OVERRIDE[id];
  return id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

function image(id) {
  if (id === 'Rogue') return '/specs/Rogue-Assassination.jpg';
  if (id === 'Mistweaver') return '/specs/Monk-Mistweaver.jpg';
  return `/specs/${id}.jpg`;
}

const specs = ids.map((id) => ({ id, label: label(id), image: image(id) }));
const outDir = path.join(__dirname, '..', 'public', 'data');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'specs.json');
fs.writeFileSync(
  outPath,
  JSON.stringify({ pricePerSpecUsdPerMonth: 6, currency: 'USD', specs }, null, 2)
);
console.log('Wrote', specs.length, 'specs to', outPath);
