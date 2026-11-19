import { LEVELS } from "../src/game/levels";
import { geometricProof, simulateSolution } from "../src/game/verify";

const physFail: number[] = [];
const bothFail: number[] = [];

for (const level of LEVELS) {
  const phys = simulateSolution(level).ok;
  const geo = geometricProof(level);
  if (!phys) physFail.push(level.id);
  if (!phys && !geo) bothFail.push(level.id);
}

console.log(`Checked ${LEVELS.length} levels.`);
console.log(`Physics solution failures: ${physFail.length}`, physFail.slice(0, 30));
console.log(`No proof at all: ${bothFail.length}`, bothFail.slice(0, 20));

if (bothFail.length || physFail.length) {
  console.error("FATAL: every level must clear headless physics with its recorded solution.");
  process.exit(1);
}

console.log("OK — every level has a physics-verified solution (bridge restore and/or bounce).");
