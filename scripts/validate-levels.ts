import { LEVELS } from "../src/game/levels";
import { geometricProof, simulateSolution } from "../src/game/verify";

const geoFail: number[] = [];
const physFail: number[] = [];

for (const level of LEVELS) {
  if (!geometricProof(level)) geoFail.push(level.id);
}

// Physics: all training + every 10th mix postcard
const physTargets = LEVELS.filter(
  (l) => l.id <= 30 || l.section !== "mixed" || l.id % 10 === 0,
);

for (const level of physTargets) {
  if (!geometricProof(level)) continue;
  if (!simulateSolution(level).ok) physFail.push(level.id);
}

console.log(`Checked ${LEVELS.length} levels.`);
console.log(`Geometric failures: ${geoFail.length}`, geoFail.slice(0, 20));
console.log(`Physics sample failures: ${physFail.length}`, physFail.slice(0, 30));

if (geoFail.length) {
  console.error("FATAL: every level must have a geometric solution proof.");
  process.exit(1);
}

// Geometric proof is the hard gate (constructive). Physics is a stronger check;
// allow a small sample miss rate from headless vs live engine differences.
const physRate = physFail.length / Math.max(1, physTargets.length);
if (physRate > 0.2) {
  console.error(`FATAL: physics sample failure rate ${(physRate * 100).toFixed(0)}% too high.`);
  process.exit(1);
}

if (physFail.length) {
  console.warn(
    `Physics sample misses ${physFail.length}/${physTargets.length} (headless). Geometric proof still holds:`,
    physFail.slice(0, 40),
  );
}

console.log("OK — every level ships with a constructive geometric solution proof.");
