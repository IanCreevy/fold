import { applyFold, clonePts, pathLooksWalkable, sampleTerrainY } from "../src/game/foldMath";
import { LEVELS } from "../src/game/levels";
import { geometricProof, simulateSolution } from "../src/game/verify";

for (const id of [11, 21, 40]) {
  const l = LEVELS.find((x) => x.id === id)!;
  let pts = clonePts(l.terrain);
  for (const f of l.solutionFolds ?? []) pts = applyFold(pts, f.x, f.deltaY, l.foldRadius);
  console.log("\n===", id, l.name, "geo", geometricProof(l));
  console.log("folds", l.solutionFolds);
  console.log(
    "profile",
    pts
      .filter((p) => p.x >= 80 && p.x <= 650)
      .map((p) => `${p.x}:${p.y.toFixed(0)}`)
      .join(" "),
  );
  console.log("walkable", pathLooksWalkable(pts, l.spawn.x, l.goal.x, l.blockers ?? []));
  console.log("sim", simulateSolution(l));
}
