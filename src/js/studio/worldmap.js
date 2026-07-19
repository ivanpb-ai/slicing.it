// ─────────────────────────────────────────────────────────────────────────
// World-map background — a stylised dotted world map whose camera slowly
// zooms into each of the slide's chosen locations in turn (pulsing marker +
// label), then back out to the full map and on to the next.
//
// makeMapRenderer(P) is a SELF-CONTAINED factory: export-html.js serialises
// it into the exported presentation with Function.toString(), so nothing in
// it may reference module scope. The land mask is a 144×66 equirectangular
// grid (lng −180…180, lat 85…−60) generated from public-domain world
// GeoJSON, packed 4 cells per hex digit.
//
//   drawMap(ctx, t, colors, locations)   renders one frame
//     colors[0] → land dots, colors[1] → markers/labels
//     locations → [{ label, lat, lng }] (1–4; falls back to Stockholm)
// ─────────────────────────────────────────────────────────────────────────
import { P } from "./model";

export function makeMapRenderer(P) {
  var MASK = "000000000000000000000000000000000000000000001ff9fffe60000000000000000000000000003be3ffff800fc00000070000000000000080070fffff000200000000400000000000007cdf007fff00000003001ff801d000000003c4ab803ffe0000000600ffffe0000000e0007e6ff03ffe000030021bffffffff0087ffffc43a381ff80001fe45ebfffffffffff3fffffffc3e1fc04007fd3fffffffffffff00fffffffe1c1f01c00f7dfffffffffffffe03ffffffe0600e00003e7fffffffffffffbc01f0ffffc0700000003e1ffffffffffffc8000601fffe07e000002073fffffffffff018000001ffffc7f00000218fffffffffffc038000000ffffeffc0000f3fffffffffffff8300000007ffffff4000037fffffffffffff0000000003fffff4e00003ffffffffffffff0000000003fffffe000001fff5f7fffffffe0000000003fffff8000001fbe1effffffffc0000000003fffff000000f94e067fffffff08000000003ffffc000000f12dff7ffffff608000000001ffff8000000f045ff3ffffff300000000000ffffc0000001f043ffffffff1700000000007fff00000007f003ffffffff0800000000005ffe0000000ffeebffffffff8000000000003fc10000000fffffefffffff8000000000000f818000001ffffff5ffffff00000000000017800000003ffffdfa1ffffe80000000000003838000007ffffeff0ff7f800000000000003884000007ffffefe07e7e000000000000001f81400003ffffe7e0783e080000000000000540000007fffff780701e0800000000000000e0000007fffffe00301f040000000000000000000003fffff800301700000000000000002af00001ffffff001010000000000000000007f80001ffffff000800020000000000000007fe000083fffe000028200000000000000007ff000000fffe00001060000000000000000fff000000fff8000008ec000000000000000fffc00000fff800000ce8400000000000000ffff80000fff0000004003c0000000000000ffffc00007ff0000002001e0000000000000ffffc00007ff0000000501a00000000000007fff800007ff0000000000000000000000007fff800007ff000000000e000000000000003fff000007ff100000003c400000000000001fff000007fe300000007fc00000000000000fff000007fc300000007fe00000000000000fff000003fc60000003fff02000000000000ffc000003fc60000007fff00000000000000ff8000003f800000007fff80000000000000ff8000003f800000003fff80000000000001ff0000001f000000003fff80000000000001fe0000001e000000003c3f80000000000001fc0000000000000000201f00000000000001f80000000000000000000f00000000000001e00000000000000000000000200000000003c00000000000000000000200400000000001c00000000000000000000200800000000003800000000000000000000001000000000003c00000000000000000000000000000000003800000000000000000000000000000000003000000000000000000000000000000000001c000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  var GW = 144, GH = 66, LAT_TOP = 85, LAT_BOT = -60;
  var W = 1280, H = 720;
  var MAP_W = 1180, MAP_H = MAP_W * GH / GW, OX = (W - MAP_W) / 2, OY = (H - MAP_H) / 2;

  // Decode the mask once into dot positions with a deterministic per-dot alpha.
  var pts = [];
  for (var i = 0; i < MASK.length; i++) {
    var v = parseInt(MASK[i], 16);
    for (var b = 0; b < 4; b++) {
      if (!(v & (8 >> b))) continue;
      var cell = i * 4 + b, gx = cell % GW, gy = (cell / GW) | 0;
      pts.push([
        OX + (gx + 0.5) / GW * MAP_W,
        OY + (gy + 0.5) / GH * MAP_H,
        0.3 + 0.3 * (((gx * 37 + gy * 61) % 10) / 10),
      ]);
    }
  }

  var proj = function (lat, lng) {
    return [OX + (lng + 180) / 360 * MAP_W, OY + (LAT_TOP - lat) / (LAT_TOP - LAT_BOT) * MAP_H];
  };
  var smooth = function (x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
  var rgbOf = function (c) {
    if (typeof c !== "string") return [0, 212, 255];
    var m = c.replace("#", "");
    if (/^[0-9a-f]{6}$/i.test(m)) return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
    var r = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
    return r ? [+r[1], +r[2], +r[3]] : [0, 212, 255];
  };
  var rgba = function (c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; };

  return function drawMap(ctx, t, colors, locations) {
    var land = rgbOf((colors && colors[0]) || P.cyan);
    var mark = rgbOf((colors && colors[1]) || P.magenta);
    var locs = (locations && locations.length ? locations : [{ label: "Stockholm", lat: 59.33, lng: 18.07 }]).slice(0, 4);

    // Camera: per-location cycle — zoom in, hold on the location, zoom back
    // out to the whole map, then start the next location's cycle.
    var D = 9, n = locs.length;
    var idx = Math.floor(t / D) % n, p = (t % D) / D;
    var zf = n ? smooth((p - 0.08) / 0.24) * (1 - smooth((p - 0.6) / 0.24)) : 0;
    var s = 1 + 2.4 * zf;
    var L = proj(locs[idx].lat || 0, locs[idx].lng || 0);
    var camX = W / 2 + (L[0] - W / 2) * zf;
    var camY = H / 2 + (L[1] - H / 2) * zf;
    var sx = function (x) { return W / 2 + (x - camX) * s; };
    var sy = function (y) { return H / 2 + (y - camY) * s; };

    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0c0322"); g.addColorStop(1, "#240a3c");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // soft glow under the active location
    var gl = ctx.createRadialGradient(sx(L[0]), sy(L[1]), 10, sx(L[0]), sy(L[1]), 190 * Math.sqrt(s));
    gl.addColorStop(0, rgba(mark, 0.10 + 0.12 * zf)); gl.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);

    // dotted land
    var r = Math.min(3, 1.5 * Math.sqrt(s));
    for (var k = 0; k < pts.length; k++) {
      var x = sx(pts[k][0]), y = sy(pts[k][1]);
      if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
      ctx.fillStyle = rgba(land, pts[k][2]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // location markers: expanding pulse ring + core + label
    for (var m = 0; m < locs.length; m++) {
      var Q = proj(locs[m].lat || 0, locs[m].lng || 0);
      var mx = sx(Q[0]), my = sy(Q[1]);
      if (mx < -80 || mx > W + 80 || my < -80 || my > H + 80) continue;
      var active = m === idx;
      var f = (t * 0.55 + m * 0.31) % 1;
      ctx.strokeStyle = rgba(mark, (1 - f) * (active ? 0.6 : 0.3));
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(mx, my, 7 + f * 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(mark, active ? 1 : 0.6);
      ctx.beginPath(); ctx.arc(mx, my, active ? 5 : 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.arc(mx, my, 1.8, 0, Math.PI * 2); ctx.fill();
      if (locs[m].label) {
        ctx.font = "12px 'JetBrains Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(10,3,24,0.55)";
        ctx.fillText(locs[m].label, mx + 1, my + 25);
        ctx.fillStyle = active ? "rgba(244,236,255,0.95)" : "rgba(244,236,255,0.55)";
        ctx.fillText(locs[m].label, mx, my + 24);
      }
    }

    // vignette
    var vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(8,2,18,0.55)");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  };
}

// Module-level instance for the Studio itself.
export const drawMap = makeMapRenderer(P);
