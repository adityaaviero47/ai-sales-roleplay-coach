// Small, dependency-free statistics helpers.

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);

export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x: number[], y: number[]): number {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2;
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
}

export const spearman = (x: number[], y: number[]) => pearson(ranks(x), ranks(y));

// Two-sided permutation test for a difference in means between two groups.
export function permutationP(a: number[], b: number[], iters = 5000, seed = 42): number {
  const rng = mulberry32(seed);
  const all = a.concat(b), obs = Math.abs(mean(a) - mean(b));
  let hits = 0;
  for (let it = 0; it < iters; it++) {
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]];
    }
    if (Math.abs(mean(all.slice(0, a.length)) - mean(all.slice(a.length))) >= obs) hits++;
  }
  return (hits + 1) / (iters + 1);
}

// Ordinary least squares with an intercept, solved by Gaussian elimination.
export function ols(X: number[][], y: number[]): number[] {
  const n = X.length, k = X[0].length + 1;
  const A = Array.from({ length: k }, () => new Array<number>(k + 1).fill(0));
  for (let r = 0; r < n; r++) {
    const row = [1, ...X[r]];
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) A[i][j] += row[i] * row[j];
      A[i][k] += row[i] * y[r];
    }
  }
  for (let i = 0; i < k; i++) A[i][i] += 1e-6; // tiny ridge for stability
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row, i) => row[k] / row[i]);
}

export const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
