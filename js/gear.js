export function gearTotals(gear, points) {
  const carryRatio = points.length ? points.filter((p) => p.segment === 'carry').length / points.length : 0;
  let backpack = 0;
  let raft = 0;
  for (const item of gear) {
    if (!item.packed) continue;
    if (item.mode === 'backpack') backpack += item.weight;
    else if (item.mode === 'raft') raft += item.weight;
    else {
      backpack += item.weight * carryRatio;
      raft += item.weight * (1 - carryRatio);
    }
  }
  return { backpack, raft, carryRatio };
}

export function criticalMissing(gear) {
  return gear.filter((g) => g.critical && !g.packed).map((g) => g.name);
}
