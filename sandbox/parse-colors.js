const fs = require('fs');

const referencePath = process.argv[2] || 'docs/reloj (2).svg';
const svg = fs.readFileSync(referencePath, 'utf8');

function extractGroupContent(id) {
  const startTag = `<g id="${id}">`;
  const start = svg.indexOf(startTag);
  if (start < 0) throw new Error(`Missing group ${id}`);
  const end = svg.indexOf('</g>', start);
  if (end < 0) throw new Error(`Unclosed group ${id}`);
  return svg.slice(start, end);
}

function angleKeyFromVectors(v1, v2) {
  const umx = v1[0] + v2[0];
  const umy = v1[1] + v2[1];
  const angDeg = (Math.atan2(umy, umx) * 180) / Math.PI;
  // Start at top (-90deg) and go clockwise (SVG coords have +y down)
  return (angDeg + 90 + 360) % 360;
}

function parsePathsInGroup(groupStr) {
  const pathRe = /<path\b[^>]*?d="([^"]+)"[^>]*?fill="([^"]+)"[^>]*?>/g;
  const items = [];

  let m;
  while ((m = pathRe.exec(groupStr))) {
    const d = m[1];
    const fill = m[2];

    const nums = [...d.matchAll(/(-?\d*\.?\d+)/g)].map((x) => Number(x[1]));
    const coords = [];
    for (let i = 0; i + 1 < nums.length; i += 2) coords.push([nums[i], nums[i + 1]]);

    const center = coords[0];
    const p1 = coords[1];
    if (!center || !p1) continue;

    let p2 = null;
    for (let i = coords.length - 1; i >= 0; i--) {
      const p = coords[i];
      if (Math.abs(p[0] - center[0]) > 1e-6 || Math.abs(p[1] - center[1]) > 1e-6) {
        p2 = p;
        break;
      }
    }
    if (!p2) continue;

    const v1 = [p1[0] - center[0], p1[1] - center[1]];
    const v2 = [p2[0] - center[0], p2[1] - center[1]];

    const r1 = Math.hypot(v1[0], v1[1]) || 1;
    const r2 = Math.hypot(v2[0], v2[1]) || 1;
    const u1 = [v1[0] / r1, v1[1] / r1];
    const u2 = [v2[0] / r2, v2[1] / r2];

    const key = angleKeyFromVectors(u1, u2);
    items.push({ fill, key });
  }

  return items.sort((a, b) => a.key - b.key);
}

const outer = parsePathsInGroup(extractGroupContent('Group 2282'));
const inner = parsePathsInGroup(extractGroupContent('Group 2282_2'));

console.log(outer.map((x) => x.fill).join(','));
console.log(inner.map((x) => x.fill).join(','));
