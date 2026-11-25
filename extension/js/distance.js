export const DamerauLevenshtein = {
  distance(a, b, maxDist) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
    const n = a.length;
    const m = b.length;
    const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = 0; i <= n; i++) d[i][0] = i;
    for (let j = 0; j <= m; j++) d[0][j] = j;
    for (let i = 1; i <= n; i++) {
      let rowMin = Infinity;
      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, d[i - 2][j - 2] + 1);
        }
        d[i][j] = v;
        rowMin = Math.min(rowMin, v);
      }
      if (rowMin > maxDist) return maxDist + 1;
    }
    return d[n][m];
  }
};
