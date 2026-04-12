import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  WORLD_COLS, WORLD_ROWS,
  ZONE_TILE_SET, ZONES, TEAM_MEMBERS, EMOTES, getLevelTier,
} from '../data/gameData';
import { createWorldRequest, fetchWorldRequests, toggleWorldRequestUpvote, subscribeToWorkSummaries, type DBWorldRequest } from '../lib/supabase';
import type { TeamMember, Zone, Emote } from '../types';

// ─── ISO CONFIG ───────────────────────────────────────────────────────────────
const TW = 72;        // tile diamond width
const TH = 36;        // tile diamond height (top face)
const WALL = 18;      // zone wall height
const GROUND_WALL = 8; // plain floor wall height

// ─── POLYTOPIA BIOME PALETTE ─────────────────────────────────────────────────
const GRASS_A = '#5a9e44';
const GRASS_B = '#4e8f3c';
const GRASS_WALL = '#30621f';
const GRASS_DARK = '#264f19';

const BIOME: Record<string, { top: string; topHL: string; wall1: string; wall2: string; outline: string }> = {
  grind_zone:   { top:'#2e7d32', topHL:'#43a047', wall1:'#1b5e20', wall2:'#1a5220', outline:'#0a2e0a' },
  idea_lab:     { top:'#6a1b9a', topHL:'#8e24aa', wall1:'#4a148c', wall2:'#3d1080', outline:'#1a0040' },
  war_room:     { top:'#bf360c', topHL:'#e64a19', wall1:'#8d2003', wall2:'#7a1a00', outline:'#3e0d00' },
  coffee_corner:{ top:'#6d4c41', topHL:'#8d6e63', wall1:'#4e342e', wall2:'#3e2723', outline:'#1a0d08' },
  watercooler:  { top:'#0277bd', topHL:'#0288d1', wall1:'#01579b', wall2:'#014080', outline:'#002244' },
  trophy_wall:  { top:'#c47d0e', topHL:'#f9a825', wall1:'#8d5e00', wall2:'#7a5000', outline:'#3d2800' },
  green_couch:  { top:'#145214', topHL:'#2e7d2e', wall1:'#0a3d0a', wall2:'#083508', outline:'#011a01' },
};

// ─── COORDINATE MATH ──────────────────────────────────────────────────────────
function iso(col: number, row: number, camX: number, camY: number) {
  return { x: (col - row) * TW / 2 - camX, y: (col + row) * TH / 2 - camY };
}

// ─── COLOR HELPERS ────────────────────────────────────────────────────────────
function hex2rgb(h: string) {
  return {
    r: parseInt(h.slice(1,3),16),
    g: parseInt(h.slice(3,5),16),
    b: parseInt(h.slice(5,7),16),
  };
}
function mix(h: string, amt: number) {
  const { r,g,b } = hex2rgb(h);
  const a = amt > 0 ? 255 : 0;
  const f = Math.abs(amt);
  return `rgb(${Math.round(r+(a-r)*f)},${Math.round(g+(a-g)*f)},${Math.round(b+(a-b)*f)})`;
}
const lighter = (h: string, f=0.18) => mix(h, f);
const darker  = (h: string, f=0.35) => mix(h,-f);

// ─── ISO PRIMITIVES ───────────────────────────────────────────────────────────

/** Diamond top face */
function diamond(ctx: CanvasRenderingContext2D, sx: number, sy: number, fill: string, tw=TW, th=TH, stroke?: string, sw=1) {
  ctx.beginPath();
  ctx.moveTo(sx,       sy);
  ctx.lineTo(sx+tw/2,  sy+th/2);
  ctx.lineTo(sx,       sy+th);
  ctx.lineTo(sx-tw/2,  sy+th/2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle=stroke; ctx.lineWidth=sw; ctx.stroke(); }
}

/** Left face of box */
function leftFace(ctx: CanvasRenderingContext2D, sx: number, sy: number, wh: number, fill: string, tw=TW, th=TH) {
  ctx.beginPath();
  ctx.moveTo(sx-tw/2, sy+th/2);
  ctx.lineTo(sx,      sy+th);
  ctx.lineTo(sx,      sy+th+wh);
  ctx.lineTo(sx-tw/2, sy+th/2+wh);
  ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
}

/** Right face of box */
function rightFace(ctx: CanvasRenderingContext2D, sx: number, sy: number, wh: number, fill: string, tw=TW, th=TH) {
  ctx.beginPath();
  ctx.moveTo(sx+tw/2, sy+th/2);
  ctx.lineTo(sx,      sy+th);
  ctx.lineTo(sx,      sy+th+wh);
  ctx.lineTo(sx+tw/2, sy+th/2+wh);
  ctx.closePath();
  ctx.fillStyle=fill; ctx.fill();
}

/** Full isometric box with top highlight ring */
function isoBox(ctx: CanvasRenderingContext2D, sx: number, sy: number, wh: number,
  top: string, hl: string, w1: string, w2: string, outline: string, tw=TW, th=TH) {
  const ty = sy - wh;
  // Outline base
  leftFace(ctx, sx, ty, wh, outline, tw+2, th+2);
  rightFace(ctx, sx, ty, wh, outline, tw+2, th+2);
  diamond(ctx, sx, ty, outline, tw+2, th+2);
  // Walls
  leftFace(ctx, sx, ty, wh, w1, tw, th);
  rightFace(ctx, sx, ty, wh, w2, tw, th);
  // Top face
  diamond(ctx, sx, ty, top, tw, th);
  // Inner highlight strip
  diamond(ctx, sx, ty+3, hl+'55', tw-8, th-4);
  // Top edge glint
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, ty);
  ctx.lineTo(sx+tw/2, ty+th/2);
  ctx.stroke();
  ctx.restore();
}

// ─── POLYTOPIA-STYLE DECORATIONS ─────────────────────────────────────────────

/** Pine tree (forest biome) */
function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1) {
  const s = scale;
  // Trunk
  ctx.fillStyle = '#5d4037';
  ctx.fillRect(x-3*s, y-8*s, 6*s, 10*s);
  // Shadow under canopy
  ctx.save(); ctx.globalAlpha=0.25;
  ctx.beginPath(); ctx.ellipse(x, y-6*s, 11*s, 5*s, 0, 0, Math.PI*2);
  ctx.fillStyle='#000'; ctx.fill(); ctx.restore();
  // Canopy layers (3 tiers, lightest on top)
  [[18,18,'#1b5e20'],[15,13,'#2e7d32'],[11,8,'#43a047']].forEach(([r,h,c],i)=>{
    ctx.beginPath();
    ctx.moveTo(x, y-(h as number)*s-28*s+(i*8*s));
    ctx.lineTo(x+(r as number)*s, y-(h as number)*s+8*s-(i*2*s));
    ctx.lineTo(x-(r as number)*s, y-(h as number)*s+8*s-(i*2*s));
    ctx.closePath();
    ctx.fillStyle = c as string;
    ctx.fill();
    ctx.strokeStyle = '#0a2e0a66'; ctx.lineWidth=0.5; ctx.stroke();
  });
  // Snow cap
  ctx.fillStyle='rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.moveTo(x, y-38*s);
  ctx.lineTo(x+5*s, y-30*s);
  ctx.lineTo(x-5*s, y-30*s);
  ctx.closePath(); ctx.fill();
}

/** Crystal spire (mystic biome) */
function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1) {
  const s = scale;
  const colors = ['#ce93d8','#ab47bc','#7b1fa2'];
  [
    [x-8*s, y, 8*s, 24*s, colors[2]],
    [x+6*s, y-4*s, 7*s, 20*s, colors[1]],
    [x, y-8*s, 9*s, 30*s, colors[0]],
  ].forEach(([cx,cy,w,h,c]) => {
    ctx.beginPath();
    ctx.moveTo(cx as number, (cy as number)-(h as number));
    ctx.lineTo((cx as number)+(w as number)/2, cy as number);
    ctx.lineTo((cx as number)-(w as number)/2, cy as number);
    ctx.closePath();
    ctx.fillStyle = c as string; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=0.5; ctx.stroke();
    // Glint
    ctx.fillStyle='rgba(255,255,255,0.4)';
    ctx.fillRect((cx as number)-1, (cy as number)-(h as number)+2, 2, 6);
  });
  // Glow
  ctx.save(); ctx.globalAlpha=0.2;
  const g=ctx.createRadialGradient(x,y-15*s,2,x,y-15*s,20*s);
  g.addColorStop(0,'#e040fb'); g.addColorStop(1,'transparent');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.arc(x,y-15*s,20*s,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/** Volcano rock (war room biome) */
function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1) {
  const s = scale;
  // Large rock
  ctx.fillStyle='#5d4037';
  ctx.beginPath();
  ctx.moveTo(x-14*s, y);
  ctx.lineTo(x-18*s, y-8*s);
  ctx.lineTo(x-8*s,  y-22*s);
  ctx.lineTo(x+2*s,  y-26*s);
  ctx.lineTo(x+14*s, y-20*s);
  ctx.lineTo(x+18*s, y-8*s);
  ctx.lineTo(x+14*s, y);
  ctx.closePath(); ctx.fill();
  // Lava crack
  ctx.strokeStyle='#ff5722'; ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(x-2*s, y-6*s);
  ctx.lineTo(x+4*s, y-14*s);
  ctx.lineTo(x-1*s, y-22*s);
  ctx.stroke();
  // Glow at crack
  ctx.save(); ctx.globalAlpha=0.3;
  ctx.strokeStyle='#ff9800'; ctx.lineWidth=3;
  ctx.beginPath();
  ctx.moveTo(x-2*s, y-6*s);
  ctx.lineTo(x+4*s, y-14*s);
  ctx.lineTo(x-1*s, y-22*s);
  ctx.stroke(); ctx.restore();
  // Rock highlight
  ctx.fillStyle='rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(x-8*s, y-22*s);
  ctx.lineTo(x+2*s, y-26*s);
  ctx.lineTo(x+6*s, y-20*s);
  ctx.closePath(); ctx.fill();
}

/** Mushroom cluster (coffee biome) */
function drawMushroom(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1) {
  const s=scale;
  [[x-8*s,y,'#a1887f',10*s],[x+4*s,y-4*s,'#d7a87c',8*s],[x,y-2*s,'#c2855a',12*s]].forEach(([mx,my,c,r])=>{
    // Stem
    ctx.fillStyle='#f5f5f5';
    ctx.fillRect((mx as number)-3*s, (my as number)-10*s, 5*s, 10*s);
    // Cap
    ctx.fillStyle=c as string;
    ctx.beginPath();
    ctx.arc(mx as number, (my as number)-(r as number)/2-6*s, r as number, Math.PI, 0);
    ctx.closePath(); ctx.fill();
    // Spots
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc((mx as number)-3*s, (my as number)-(r as number)/2-8*s, 1.5*s, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc((mx as number)+2*s, (my as number)-(r as number)/2-11*s, 1*s, 0, Math.PI*2); ctx.fill();
  });
}

/** Ice formation (watercooler biome) */
function drawIce(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1, tick=0) {
  const s=scale;
  // Shimmering glow base
  ctx.save();
  ctx.globalAlpha=0.15+Math.sin(tick*0.05)*0.05;
  const g=ctx.createRadialGradient(x,y-10*s,2,x,y-10*s,18*s);
  g.addColorStop(0,'#80d8ff'); g.addColorStop(1,'transparent');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.arc(x,y-10*s,18*s,0,Math.PI*2); ctx.fill();
  ctx.restore();
  // Ice spikes
  [
    [x-6*s,y,5*s,20*s,'#b3e5fc'],
    [x+7*s,y-2*s,4*s,16*s,'#81d4fa'],
    [x,y-2*s,6*s,26*s,'#e1f5fe'],
  ].forEach(([ix,iy,iw,ih,ic])=>{
    ctx.beginPath();
    ctx.moveTo(ix as number, (iy as number)-(ih as number));
    ctx.lineTo((ix as number)+(iw as number)/2, iy as number);
    ctx.lineTo((ix as number)-(iw as number)/2, iy as number);
    ctx.closePath();
    ctx.fillStyle=ic as string; ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=0.5; ctx.stroke();
  });
}

/** Ancient column / ruins (trophy biome) */
function drawColumn(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1) {
  const s=scale;
  [[x-10*s,y],[x+8*s,y-2*s]].forEach(([cx,cy])=>{
    // Base
    ctx.fillStyle='#8d6e00';
    ctx.fillRect((cx as number)-5*s, (cy as number)-2*s, 10*s, 3*s);
    // Shaft
    ctx.fillStyle='#c49a00';
    ctx.fillRect((cx as number)-3.5*s, (cy as number)-20*s, 7*s, 18*s);
    // Fluting
    ctx.fillStyle='rgba(0,0,0,0.15)';
    ctx.fillRect((cx as number)-1*s, (cy as number)-20*s, 2*s, 18*s);
    // Capital
    ctx.fillStyle='#e6b800';
    ctx.fillRect((cx as number)-5.5*s, (cy as number)-22*s, 11*s, 4*s);
  });
  // Gold coins / sparkles between columns
  const t = 0;
  [[-2,10],[2,6],[0,2]].forEach(([dx,dy])=>{
    ctx.fillStyle='#fdd835';
    ctx.beginPath();
    ctx.arc(x+dx*s, y-dy*s, 2*s, 0, Math.PI*2);
    ctx.fill();
  });
}

/** Iconic Green Couch (DOME Meeting spot) — isometric 3-face rendering */
function drawCouch(ctx: CanvasRenderingContext2D, x: number, y: number, scale=1, tick=0) {
  const s = scale;

  // ── Colour palette ─────────────────────────────────────────────────────────
  const TOP    = '#43a047'; // top faces  (lightest)
  const FRONT  = '#2e7d32'; // front faces (mid)
  const SIDE   = '#1b5e20'; // side faces  (dark)
  const SHADOW = '#0a2e0a'; // deep shadow / dividers
  const FABRIC = '#66bb6a'; // subtle highlight on cushion surface
  const WOOD   = '#4e342e'; // legs

  // ── Layout dimensions ──────────────────────────────────────────────────────
  const W    = 32 * s;  // total couch width
  const aW   = 5  * s;  // armrest width
  const iW   = W - aW*2; // inner seat width (between armrests)
  const legH = 4  * s;  // leg height below seat base
  const sH   = 7  * s;  // seat front-face height
  const backH = 18 * s; // back-rest front-face height
  const armH  = 10 * s; // armrest height above seat top
  // Isometric "depth" offset: gives every horizontal surface a parallelogram top-face
  const dx = 5  * s;   // screen-x shift for depth
  const dy = 2.5* s;   // screen-y shift for depth

  // Anchor: x = horizontal center, y = ground level (bottom of legs)
  const legBot  = y;
  const seatBot = legBot  - legH;
  const seatTop = seatBot - sH;
  const armTop  = seatTop - armH;
  const backTop = seatTop - backH;
  const L       = x - W/2;   // left edge
  const R       = x + W/2;   // right edge
  const iL      = L + aW;    // inner-left
  const iR      = R - aW;    // inner-right

  // Helper: draw a face as a parallelogram (offset top-left by dx,dy)
  const para = (lx: number, ty: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(lx,    ty);
    ctx.lineTo(lx-dx, ty+dy);
    ctx.lineTo(lx-dx, ty+dy+h);
    ctx.lineTo(lx,    ty+h);
    ctx.closePath();
    ctx.fill();
  };

  // Helper: horizontal top face as parallelogram (given bottom-left corner)
  const topFace = (lx: number, bY: number, w: number, col: string) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(lx,    bY);
    ctx.lineTo(lx-dx, bY+dy);
    ctx.lineTo(lx-dx+w, bY+dy);
    ctx.lineTo(lx+w, bY);
    ctx.closePath();
    ctx.fill();
  };

  // ── Subtle ground glow ─────────────────────────────────────────────────────
  const glowA = 0.18 + 0.05 * Math.sin(tick * 0.05);
  const grd = ctx.createRadialGradient(x-dx/2, seatBot+dy/2, 2, x-dx/2, seatBot+dy/2, 24*s);
  grd.addColorStop(0, `rgba(76,175,80,${glowA})`);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(x-dx/2, seatBot+dy/2, 24*s, 8*s, 0, 0, Math.PI*2);
  ctx.fill();

  // ══ BACK REST — drawn first (furthest back) ════════════════════════════════

  // Left side face (shadow parallelogram — only visible on left armrest edge)
  para(L, backTop, aW, backH + sH + legH, SHADOW);

  // Back-rest front face — two cushions with divider
  ctx.fillStyle = SIDE;
  ctx.fillRect(L, backTop, W, backH);
  // Cushion highlights
  ctx.fillStyle = FABRIC; ctx.globalAlpha = 0.1;
  ctx.fillRect(L+2*s, backTop+2*s, iW/2-4*s, backH-4*s);
  ctx.fillRect(x+2*s, backTop+2*s, iW/2-4*s, backH-4*s);
  ctx.globalAlpha = 1;
  // Cushion seam (vertical divider)
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x-1.5*s, backTop+2*s, 3*s, backH-4*s);

  // Back-rest top face
  topFace(L, backTop, W, FRONT);
  // Thin highlight line along top edge
  ctx.save(); ctx.globalAlpha = 0.35;
  ctx.strokeStyle = TOP; ctx.lineWidth = 1.5*s;
  ctx.beginPath(); ctx.moveTo(L, backTop); ctx.lineTo(R, backTop); ctx.stroke();
  ctx.restore();

  // ══ ARMRESTS ══════════════════════════════════════════════════════════════

  // Left armrest — side face + front face + top face
  para(L, armTop, aW, armH+sH+legH, SHADOW);
  ctx.fillStyle = SIDE;
  ctx.fillRect(L, armTop, aW, armH+sH+legH);
  topFace(L, armTop, aW, TOP);

  // Right armrest — front face + top face (no visible side face)
  ctx.fillStyle = SIDE;
  ctx.fillRect(iR, armTop, aW, armH+sH+legH);
  topFace(iR, armTop, aW, TOP);

  // ══ SEAT ══════════════════════════════════════════════════════════════════

  // Seat left side face
  para(iL, seatTop, 1*s, sH, SHADOW);

  // Seat front face — two cushions
  ctx.fillStyle = FRONT;
  ctx.fillRect(iL, seatTop, iW/2, sH);
  ctx.fillRect(iL+iW/2, seatTop, iW/2, sH);
  // Cushion seam
  ctx.fillStyle = SHADOW;
  ctx.fillRect(x-1*s, seatTop+1*s, 2*s, sH-2*s);
  // Cushion bevel highlights
  ctx.fillStyle = TOP; ctx.globalAlpha = 0.15;
  ctx.fillRect(iL+2*s, seatTop+1*s, iW/2-6*s, 2*s);
  ctx.fillRect(x+3*s, seatTop+1*s, iW/2-6*s, 2*s);
  ctx.globalAlpha = 1;

  // Seat top face (visible from above — lightest surface)
  topFace(iL, seatTop, iW, TOP);
  // Cushion seam continues on top face
  ctx.strokeStyle = FRONT; ctx.lineWidth = 0.8*s;
  ctx.beginPath();
  ctx.moveTo(x, seatTop);
  ctx.lineTo(x-dx, seatTop+dy);
  ctx.stroke();

  // ══ LEGS ══════════════════════════════════════════════════════════════════

  // Front two legs
  ctx.fillStyle = WOOD;
  ctx.fillRect(iL+2*s, seatBot, 3*s, legH);
  ctx.fillRect(iR-5*s, seatBot, 3*s, legH);
  // Leg side faces (darker)
  ctx.fillStyle = '#2d1a17';
  para(iL+2*s, seatBot, 1*s, legH, '#2d1a17');
  para(iR-5*s, seatBot, 1*s, legH, '#2d1a17');

  // ══ DOME MEETING LABEL ════════════════════════════════════════════════════

  ctx.save();
  ctx.globalAlpha = 0.88 + 0.08 * Math.sin(tick * 0.05);
  const lbl = '🛋️ DOME MEETING';
  ctx.font = `bold ${Math.round(7.5*s)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lw = ctx.measureText(lbl).width;
  const pad = 5*s, tH = 12*s;
  const tY = armTop - 13*s;
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.beginPath();
  ctx.roundRect(x - lw/2 - pad, tY, lw + pad*2, tH, 3*s);
  ctx.fill();
  ctx.fillStyle = '#a5f3a7';
  ctx.fillText(lbl, x, tY + tH/2);
  ctx.restore();
}

// ─── GRASS TILE ───────────────────────────────────────────────────────────────
function drawGrassTile(ctx: CanvasRenderingContext2D, sx: number, sy: number, alt: boolean) {
  const top = alt ? GRASS_B : GRASS_A;
  const wall1 = alt ? GRASS_DARK : GRASS_WALL;
  const wall2 = alt ? GRASS_WALL : GRASS_DARK;
  isoBox(ctx, sx, sy, GROUND_WALL, top, lighter(top,0.12), wall1, wall2, '#1a3310');
}

// ─── PLAYER AVATARS (Polytopia tribe style) ───────────────────────────────────

function drawPolyAvatar(
  ctx: CanvasRenderingContext2D,
  member: TeamMember,
  sx: number, sy: number,
  isControlled: boolean,
  moving: boolean,
  animFrame: number,
  emote: string | null,
  emoteTimer: number,
  tick: number,
) {
  const tier = getLevelTier(member.level);
  const isOffline = member.status === 'offline';
  const legSwing = moving ? Math.sin(tick * 0.35) * 4 : 0;
  const bob = moving ? Math.abs(Math.sin(tick * 0.35)) * -2 : 0;

  ctx.save();
  ctx.globalAlpha = isOffline ? 0.4 : 1;

  const bx = sx;
  const by = sy + TH / 2 + bob;

  // ── Shadow ellipse
  ctx.save(); ctx.globalAlpha *= 0.3;
  ctx.beginPath(); ctx.ellipse(bx, by + 2, 12, 5, 0, 0, Math.PI*2);
  ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();

  // ── Legs (chunky Polytopia style)
  ctx.fillStyle = darker(member.avatarColor, 0.4);
  // Left leg
  ctx.beginPath();
  ctx.roundRect(bx - 7, by - 12, 6, 12 + legSwing, 2);
  ctx.fill();
  // Right leg
  ctx.beginPath();
  ctx.roundRect(bx + 1, by - 12, 6, 12 - legSwing, 2);
  ctx.fill();
  // Boots
  ctx.fillStyle = '#3e2723';
  ctx.beginPath(); ctx.roundRect(bx - 8, by - 2 + legSwing, 8, 4, 1); ctx.fill();
  ctx.beginPath(); ctx.roundRect(bx + 1, by - 2 - legSwing, 8, 4, 1); ctx.fill();

  // ── Body (Polytopia tribe tunic – chunky, slightly trapezoidal)
  const bodyTop = by - 28;
  // Body shadow (right)
  ctx.fillStyle = darker(member.avatarColor, 0.3);
  ctx.beginPath(); ctx.roundRect(bx + 4, bodyTop + 4, 8, 16, 2); ctx.fill();
  // Main body
  ctx.fillStyle = member.avatarColor;
  ctx.beginPath();
  ctx.moveTo(bx - 9, bodyTop);
  ctx.lineTo(bx + 9, bodyTop);
  ctx.lineTo(bx + 11, bodyTop + 16);
  ctx.lineTo(bx - 11, bodyTop + 16);
  ctx.closePath(); ctx.fill();
  // Tunic highlight
  ctx.fillStyle = lighter(member.avatarColor, 0.25);
  ctx.fillRect(bx - 6, bodyTop + 2, 7, 6);
  // Belt
  ctx.fillStyle = '#3e2723';
  ctx.fillRect(bx - 10, bodyTop + 13, 20, 3);

  // ── Cape
  if (tier.cape) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = tier.color;
    ctx.beginPath();
    ctx.moveTo(bx - 9, bodyTop + 2);
    ctx.lineTo(bx - 14, bodyTop + 22 + (moving ? legSwing : 0));
    ctx.lineTo(bx + 14, bodyTop + 22 + (moving ? -legSwing : 0));
    ctx.lineTo(bx + 9, bodyTop + 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.restore();
  }

  // ── Shoulder pads (Polytopia warrior look)
  ctx.fillStyle = darker(member.avatarColor, 0.2);
  ctx.beginPath(); ctx.arc(bx - 9, bodyTop + 3, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 9, bodyTop + 3, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = lighter(member.avatarColor, 0.15);
  ctx.beginPath(); ctx.arc(bx - 9, bodyTop + 3, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 9, bodyTop + 3, 3, 0, Math.PI*2); ctx.fill();

  // ── Head (round, Polytopia-style)
  const hy = bodyTop - 10;
  // Head shadow
  ctx.fillStyle = darker(member.avatarColor, 0.25);
  ctx.beginPath(); ctx.arc(bx + 1, hy + 1, 10, 0, Math.PI*2); ctx.fill();
  // Head base
  ctx.fillStyle = '#ffcc99'; // skin tone
  ctx.beginPath(); ctx.arc(bx, hy, 10, 0, Math.PI*2); ctx.fill();
  // Rosy cheeks
  ctx.save(); ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#ff8a80';
  ctx.beginPath(); ctx.arc(bx - 5, hy + 2, 3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 5, hy + 2, 3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  // Eyes
  ctx.fillStyle = '#1a237e';
  ctx.beginPath(); ctx.arc(bx - 3, hy - 1, 2.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 3, hy - 1, 2.2, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(bx - 2.5, hy - 1.5, 0.8, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bx + 3.5, hy - 1.5, 0.8, 0, Math.PI*2); ctx.fill();
  // Smile
  ctx.strokeStyle = '#5d3a1a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, hy + 2, 3.5, 0.15, Math.PI - 0.15); ctx.stroke();

  // ── Helmet (tribe color, Polytopia style)
  ctx.fillStyle = member.avatarColor;
  ctx.beginPath();
  ctx.arc(bx, hy - 4, 11, Math.PI, 0); ctx.fill();
  ctx.fillRect(bx - 11, hy - 8, 22, 6);
  // Helmet rim
  ctx.fillStyle = darker(member.avatarColor, 0.2);
  ctx.fillRect(bx - 12, hy - 2, 24, 3);
  // Helmet highlight
  ctx.fillStyle = lighter(member.avatarColor, 0.3);
  ctx.beginPath(); ctx.arc(bx - 4, hy - 7, 4, Math.PI * 1.1, Math.PI * 1.8); ctx.fill();

  // ── Crown (level 21+)
  if (tier.crown) {
    const cy = hy - 15;
    ctx.fillStyle = '#ffd600';
    ctx.beginPath();
    ctx.moveTo(bx - 7, cy + 6);
    ctx.lineTo(bx - 7, cy);
    ctx.lineTo(bx - 2, cy + 5);
    ctx.lineTo(bx, cy - 2);
    ctx.lineTo(bx + 2, cy + 5);
    ctx.lineTo(bx + 7, cy);
    ctx.lineTo(bx + 7, cy + 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ff8f00'; ctx.lineWidth = 0.5; ctx.stroke();
    // Gems
    [[bx-6,cy+1,'#e53935'],[bx,cy-2,'#43a047'],[bx+6,cy+1,'#1565c0']].forEach(([gx,gy,gc])=>{
      ctx.fillStyle = gc as string;
      ctx.beginPath(); ctx.arc(gx as number, gy as number, 1.5, 0, Math.PI*2); ctx.fill();
    });
  }

  // ── Controlled ring (spinning)
  if (isControlled) {
    ctx.save();
    ctx.strokeStyle = member.avatarAccent;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.lineDashOffset = -tick * 0.2;
    ctx.beginPath(); ctx.arc(bx, hy, 15, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    // Selection glow
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.arc(bx, hy, 16, 0, Math.PI*2);
    ctx.fillStyle = member.avatarAccent; ctx.fill();
    ctx.restore();
  }

  // ── Name plate (Polytopia style — thick, with background color)
  const nameY = hy - (tier.crown ? 26 : 16) - 6;
  ctx.font = 'bold 11px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const nw = ctx.measureText(member.name).width;

  // Plate background
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeStyle = isControlled ? member.avatarAccent + 'cc' : member.avatarColor + '88';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(bx - nw/2 - 6, nameY - 9, nw + 12, 16, 4);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = isControlled ? member.avatarAccent : '#f5f5f5';
  ctx.fillText(member.name, bx, nameY - 1);

  // Level tag (colored like tier)
  ctx.font = 'bold 8px monospace';
  ctx.fillStyle = tier.color;
  ctx.fillText(`Lv${member.level}`, bx, nameY + 8);

  // ── Status dot (glowing when online)
  const statusColor = member.status === 'online' ? '#69f0ae' : member.status === 'away' ? '#ffcc02' : '#546e7a';
  const dotX = bx + nw/2 + 5;
  const dotY = nameY - 10;
  if (member.status === 'online') {
    ctx.save(); ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(dotX, dotY, 5, 0, Math.PI*2);
    ctx.fillStyle = statusColor; ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); ctx.arc(dotX, dotY, 3, 0, Math.PI*2);
  ctx.fillStyle = statusColor; ctx.fill();

  // ── Emote bubble
  if (emote && emoteTimer > 0) {
    const ey = nameY - 24;
    ctx.save();
    ctx.globalAlpha = Math.min(1, emoteTimer / 15);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath(); ctx.arc(bx, ey, 14, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = member.avatarColor; ctx.lineWidth = 1.5; ctx.stroke();
    // Tail
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(bx - 4, ey + 12);
    ctx.lineTo(bx + 4, ey + 12);
    ctx.lineTo(bx, ey + 20);
    ctx.closePath(); ctx.fill();
    ctx.font = '15px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emote, bx, ey);
    ctx.restore();
  }

  ctx.restore();
}

// ─── CLOUD RENDERER ───────────────────────────────────────────────────────────

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#ffffff';
  [[0,0,scale*22],[scale*18,-scale*8,scale*16],[scale*36,0,scale*18],[scale*52,scale*4,scale*14]].forEach(([cx,cy,r])=>{
    ctx.beginPath(); ctx.arc(x+(cx as number), y+(cy as number), r as number, 0, Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

// ─── WORLD STATE ──────────────────────────────────────────────────────────────

interface PlayerState {
  x: number; y: number;
  dir: 'n'|'s'|'e'|'w';
  moving: boolean;
  frame: number;
  emote: string | null;
  emoteTimer: number;
}

interface WorldMapProps {
  controlledMemberId: string;
  onZoneEnter?: (zone: Zone) => void;
  onZoneAction?: (zone: Zone) => void;
  onChallenge?: (targetId: string) => void;
  chatMessages: { id: string; authorId: string; text: string; createdAt: number }[];
  onSendChat: (text: string) => void;
  playerCoins?: number;
  liveMembers?: import('../types').TeamMember[];
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function WorldMap({ controlledMemberId, onZoneEnter, onZoneAction, onChallenge, chatMessages, onSendChat, playerCoins, liveMembers }: WorldMapProps) {
  // Use liveMembers if provided, otherwise fall back to static TEAM_MEMBERS
  const members = liveMembers && liveMembers.length > 0 ? liveMembers : TEAM_MEMBERS;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);
  const tickRef = useRef<number>(0);

  const [chatInput, setChatInput] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [hoveredMember, setHoveredMember] = useState<TeamMember | null>(null);
  const [nearbyMember, setNearbyMember] = useState<TeamMember | null>(null);

  const camRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const statesRef = useRef<Record<string, PlayerState>>({});
  const currentZoneRef = useRef<Zone | null>(null);

  // ── DOME Brain ripple effects ─────────────────────────────────────────────
  interface BrainRipple { id: number; gridX: number; gridY: number; startTime: number; color: string; label: string; }
  const ripplesRef = useRef<BrainRipple[]>([]);
  const rippleIdRef = useRef(0);

  const [playerStates, setPlayerStates] = useState<Record<string, PlayerState>>(() => {
    const init = Object.fromEntries(members.map(m => [m.id, {
      x: m.worldX, y: m.worldY, dir: 's' as const,
      moving: false, frame: 0, emote: null, emoteTimer: 0,
    }]));
    statesRef.current = init;
    return init;
  });

  // Sync ref with state
  useEffect(() => { statesRef.current = playerStates; }, [playerStates]);

  // ── Subscribe to DOME Brain work summaries → trigger ripple on map ─────────
  useEffect(() => {
    const channel = subscribeToWorkSummaries((summary) => {
      // Find the team member by name (dome_work_summaries stores name, not id)
      const member = members.find(m => m.name.toLowerCase() === summary.team_member.toLowerCase());
      const state = member ? statesRef.current[member.id] : null;
      const gridX = state?.x ?? (member?.worldX ?? 0);
      const gridY = state?.y ?? (member?.worldY ?? 0);
      const color = member?.avatarColor ?? '#6366f1';
      const label = `🧠 ${summary.team_member}`;
      ripplesRef.current = [
        ...ripplesRef.current,
        { id: rippleIdRef.current++, gridX, gridY, startTime: Date.now(), color, label },
      ];
    });
    return () => { channel.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCamera = useCallback((nx: number, ny: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const { x: sx, y: sy } = iso(nx, ny, 0, 0);
    camRef.current.tx = sx - c.width / 2 + TW / 2;
    camRef.current.ty = sy - c.height / 2 + TH;
  }, []);

  const movePlayer = useCallback(() => {
    const now = Date.now();
    if (now - lastMoveRef.current < 175) return;
    const keys = keysRef.current;
    let dx = 0, dy = 0;
    type D = 'n'|'s'|'e'|'w';
    let dir: D = 's';
    if (keys.has('w')||keys.has('arrowup'))    { dx=-1; dy=-1; dir='n'; }
    else if (keys.has('s')||keys.has('arrowdown'))  { dx=1;  dy=1;  dir='s'; }
    else if (keys.has('a')||keys.has('arrowleft'))  { dx=-1; dy=1;  dir='w'; }
    else if (keys.has('d')||keys.has('arrowright')) { dx=1;  dy=-1; dir='e'; }
    if (!dx && !dy) return;
    lastMoveRef.current = now;

    setPlayerStates(prev => {
      const s = prev[controlledMemberId];
      if (!s) return prev;
      const nx = Math.max(0, Math.min(WORLD_COLS-1, s.x+dx));
      const ny = Math.max(0, Math.min(WORLD_ROWS-1, s.y+dy));
      const ns = { ...s, x:nx, y:ny, dir, moving:true, frame:(s.frame+1)%8 };
      const zone = ZONE_TILE_SET[`${nx},${ny}`] || null;
      setCurrentZone(zone);
      currentZoneRef.current = zone;
      if (zone && onZoneEnter) onZoneEnter(zone);
      updateCamera(nx, ny);

      // Proximity: find any teammate within 2 tiles
      const nearby = members.find(m => {
        if (m.id === controlledMemberId || m.status === 'offline') return false;
        const ms = prev[m.id];
        if (!ms) return false;
        return Math.abs(ms.x - nx) <= 2 && Math.abs(ms.y - ny) <= 2;
      }) || null;
      setNearbyMember(nearby);

      return { ...prev, [controlledMemberId]: ns };
    });
  }, [controlledMemberId, onZoneEnter, updateCamera]);

  useEffect(() => {
    const KEYS = ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
    const dn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (KEYS.includes(k)) { e.preventDefault(); keysRef.current.add(k); }
      if (k === 'e') {
        const zone = currentZoneRef.current;
        if (zone && zone.action && onZoneAction) onZoneAction(zone);
      }
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key.toLowerCase());
      if (!keysRef.current.size) {
        setPlayerStates(p => ({ ...p, [controlledMemberId]: { ...p[controlledMemberId], moving:false } }));
      }
    };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, [controlledMemberId, onZoneAction]);

  // Init camera
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const s = playerStates[controlledMemberId];
    if (!s) return;
    const { x: sx, y: sy } = iso(s.x, s.y, 0, 0);
    const tx = sx - c.width/2 + TW/2;
    const ty = sy - c.height/2 + TH;
    camRef.current = { x: tx, y: ty, tx, ty };
  }, []); // eslint-disable-line

  // Main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);

    const loop = () => {
      tickRef.current++;
      const tick = tickRef.current;
      const cam = camRef.current;

      // Lerp camera
      cam.x += (cam.tx - cam.x) * 0.12;
      cam.y += (cam.ty - cam.y) * 0.12;

      // Handle input
      movePlayer();

      // Tick emote timers
      if (tick % 3 === 0) {
        setPlayerStates(prev => {
          let changed = false;
          const next = { ...prev };
          for (const id in next) {
            if (next[id].emoteTimer > 0) {
              next[id] = { ...next[id], emoteTimer: next[id].emoteTimer - 1 };
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // ── SKY GRADIENT BACKGROUND (Polytopia blue sky)
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#2979ff');
      sky.addColorStop(0.35, '#40c4ff');
      sky.addColorStop(0.65, '#80deea');
      sky.addColorStop(1, '#b2ebf2');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // ── CLOUDS (drifting slowly)
      const cloudOffset = (tick * 0.12) % (W + 200);
      [[(-cloudOffset + 60) % W, H * 0.12, 0.7],
       [(W - cloudOffset + 250) % W, H * 0.06, 0.5],
       [(cloudOffset * 0.6 + 400) % W, H * 0.18, 0.55]].forEach(([cx,cy,cs]) => {
        drawCloud(ctx, cx as number, cy as number, cs as number);
      });

      // ── GROUND HORIZON (subtle)
      const horizGrad = ctx.createLinearGradient(0, H*0.55, 0, H*0.7);
      horizGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
      horizGrad.addColorStop(1, 'rgba(0,0,0,0.15)');
      ctx.fillStyle = horizGrad;
      ctx.fillRect(0, H*0.55, W, H*0.45);

      // ── BUILD RENDER LIST (painter's algorithm)
      interface RItem { sort: number; draw: () => void }
      const items: RItem[] = [];

      for (let row = 0; row < WORLD_ROWS; row++) {
        for (let col = 0; col < WORLD_COLS; col++) {
          const zone = ZONE_TILE_SET[`${col},${row}`];
          const { x: sx, y: sy } = iso(col, row, cam.x, cam.y);

          // Skip if off-screen
          if (sx + TW < -20 || sx - TW > W + 20 || sy + TH + WALL + 60 < 0 || sy - 20 > H + 20) continue;

          if (zone) {
            const b = BIOME[zone.id] || BIOME.grind_zone;
            items.push({ sort: col+row, draw: () => isoBox(ctx, sx, sy, WALL, b.top, b.topHL, b.wall1, b.wall2, b.outline) });
          } else {
            const alt = (col+row) % 2 === 1;
            items.push({ sort: col+row-0.01, draw: () => drawGrassTile(ctx, sx, sy, alt) });
          }
        }
      }

      // ── ZONE DECORATIONS
      const drawnZoneDecors = new Set<string>();
      for (const zone of ZONES) {
        if (drawnZoneDecors.has(zone.id) || !zone.tiles.length) continue;
        drawnZoneDecors.add(zone.id);

        const decorators: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, tick: number) => void> = {
          grind_zone: (c,x,y,s) => drawTree(c,x,y,s),
          idea_lab:   (c,x,y,s) => drawCrystal(c,x,y,s),
          war_room:   (c,x,y,s) => drawRock(c,x,y,s),
          coffee_corner:(c,x,y,s) => drawMushroom(c,x,y,s),
          watercooler:(c,x,y,s,t) => drawIce(c,x,y,s,t),
          trophy_wall:(c,x,y,s) => drawColumn(c,x,y,s),
          green_couch:(c,x,y,s,t) => drawCouch(c,x,y,s,t),
        };

        const decorFn = decorators[zone.id];
        if (!decorFn) continue;

        // Pick 2-3 tiles spread across the zone
        const step = Math.max(1, Math.floor(zone.tiles.length / 3));
        [0, step, step*2].forEach(idx => {
          const t = zone.tiles[Math.min(idx, zone.tiles.length-1)];
          if (!t) return;
          const { x: sx, y: sy } = iso(t.x, t.y, cam.x, cam.y);
          const topY = sy - WALL;
          items.push({ sort: t.x+t.y+0.3, draw: () => decorFn(ctx, sx, topY, 0.9, tick) });
        });

        // Zone name label at center
        const minX = Math.min(...zone.tiles.map(t=>t.x));
        const maxX = Math.max(...zone.tiles.map(t=>t.x));
        const minY = Math.min(...zone.tiles.map(t=>t.y));
        const maxY = Math.max(...zone.tiles.map(t=>t.y));
        const cCol = (minX+maxX)/2, cRow = (minY+maxY)/2;
        const { x: lx, y: ly } = iso(cCol, cRow, cam.x, cam.y);
        items.push({
          sort: cCol+cRow+0.1,
          draw: () => {
            const b = BIOME[zone.id] || BIOME.grind_zone;
            const lbl = `${zone.emoji} ${zone.name}`;
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const lw = ctx.measureText(lbl).width;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.beginPath();
            ctx.roundRect(lx-lw/2-6, ly-WALL-16, lw+12, 14, 4);
            ctx.fill();
            ctx.fillStyle = b.topHL;
            ctx.fillText(lbl, lx, ly-WALL-9);
          },
        });
      }

      // ── PLAYERS
      const states = statesRef.current;
      for (const member of members) {
        const s = states[member.id];
        if (!s) continue;
        const { x: sx, y: sy } = iso(s.x, s.y, cam.x, cam.y);
        items.push({
          sort: s.x+s.y+0.6,
          draw: () => drawPolyAvatar(
            ctx, member, sx, sy - WALL + TH/2,
            member.id === controlledMemberId,
            s.moving, s.frame, s.emote, s.emoteTimer, tick,
          ),
        });
      }

      // ── RENDER (back to front)
      items.sort((a,b) => a.sort - b.sort);
      items.forEach(i => i.draw());

      // ── DOME BRAIN RIPPLES ─────────────────────────────────────────────────
      const now = Date.now();
      const RIPPLE_DURATION = 3200;
      ripplesRef.current = ripplesRef.current.filter(r => now - r.startTime < RIPPLE_DURATION);
      for (const ripple of ripplesRef.current) {
        const progress = (now - ripple.startTime) / RIPPLE_DURATION;
        const { x: rx, y: ry } = iso(ripple.gridX, ripple.gridY, cam.x, cam.y);
        const centerX = rx;
        const centerY = ry + TH / 2 - WALL;
        // Draw 3 expanding rings with staggered timing
        for (let ring = 0; ring < 3; ring++) {
          const ringProgress = Math.max(0, Math.min(1, (progress - ring * 0.18)));
          if (ringProgress <= 0) continue;
          const alpha = (1 - ringProgress) * 0.75;
          const radiusX = ringProgress * 54;
          const radiusY = ringProgress * 27;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = ripple.color;
          ctx.lineWidth = 2.5 - ring * 0.5;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // Label (fades in quickly, stays, then fades out)
        if (progress < 0.85) {
          const labelAlpha = progress < 0.12 ? progress / 0.12 : (1 - (progress - 0.65) / 0.2);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, labelAlpha));
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const labelW = ctx.measureText(ripple.label).width;
          ctx.fillStyle = 'rgba(0,0,0,0.72)';
          ctx.beginPath();
          ctx.roundRect(centerX - labelW / 2 - 6, centerY - WALL - 20, labelW + 12, 16, 4);
          ctx.fill();
          ctx.fillStyle = ripple.color;
          ctx.fillText(ripple.label, centerX, centerY - WALL - 12);
          ctx.restore();
        }
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener('resize', resize); };
  }, [movePlayer, controlledMemberId]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const cam = camRef.current;
    let found: TeamMember | null = null, best = 28;
    for (const m of members) {
      const s = statesRef.current[m.id];
      if (!s) continue;
      const { x: sx, y: sy } = iso(s.x, s.y, cam.x, cam.y);
      const ax = sx, ay = sy - WALL + TH/2 - 20;
      const d = Math.hypot(mx-ax, my-ay);
      if (d < best) { best=d; found=m; }
    }
    setHoveredMember(found);
  };

  const sendEmote = (emote: Emote) => {
    setPlayerStates(p => ({
      ...p,
      [controlledMemberId]: { ...p[controlledMemberId], emote: emote.emoji, emoteTimer: 160 },
    }));
    setShowEmotes(false);
  };

  const me = members.find(m => m.id === controlledMemberId) || TEAM_MEMBERS[0];

  // ─── World Lab state ───────────────────────────────────────────────────────
  const [showWorldLab, setShowWorldLab] = useState(false);
  const [worldRequests, setWorldRequests] = useState<DBWorldRequest[]>([]);
  const [wlTitle, setWlTitle] = useState('');
  const [wlDesc, setWlDesc] = useState('');
  const [wlCategory, setWlCategory] = useState<DBWorldRequest['category']>('other');
  const [wlSubmitting, setWlSubmitting] = useState(false);
  const [wlSubmitted, setWlSubmitted] = useState(false);

  useEffect(() => {
    if (showWorldLab) {
      fetchWorldRequests().then(setWorldRequests);
    }
  }, [showWorldLab]);

  const handleWorldLabSubmit = async () => {
    if (!wlTitle.trim()) return;
    setWlSubmitting(true);
    await createWorldRequest({
      author_id: controlledMemberId,
      title: wlTitle.trim(),
      description: wlDesc.trim() || null,
      category: wlCategory,
      status: 'open',
      upvotes: [],
    });
    setWlTitle(''); setWlDesc(''); setWlCategory('other');
    setWlSubmitting(false);
    setWlSubmitted(true);
    setTimeout(() => setWlSubmitted(false), 3000);
    fetchWorldRequests().then(setWorldRequests);
  };

  const handleWorldUpvote = async (req: DBWorldRequest) => {
    const next = await toggleWorldRequestUpvote(req.id, controlledMemberId, req.upvotes);
    setWorldRequests(prev => prev.map(r => r.id === req.id ? { ...r, upvotes: next } : r));
  };

  const CATEGORY_LABELS: Record<DBWorldRequest['category'], string> = {
    new_zone: '🏗️ New Zone',
    decoration: '🎨 Decoration',
    event: '🎉 Event',
    rule_change: '📋 Rule Change',
    other: '💬 Other',
  };

  return (
    <div className="flex gap-3 h-full">
      {/* Canvas */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="relative rounded-2xl overflow-hidden flex-1" style={{ border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 0 40px rgba(41,121,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.05)' }}>
          <canvas ref={canvasRef} className="block w-full h-full cursor-crosshair" style={{ minHeight: 380 }} onMouseMove={handleMouseMove} />

          {/* Zone prompt */}
          {currentZone && (() => {
            const b = BIOME[currentZone.id] || BIOME.grind_zone;
            return (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2"
                style={{ background:'rgba(0,0,0,0.8)', border:`2px solid ${b.topHL}88`, boxShadow:`0 0 16px ${b.topHL}44`, backdropFilter:'blur(6px)' }}>
                <span className="text-lg">{currentZone.emoji}</span>
                <span>{currentZone.name}</span>
                {currentZone.action && (
                  <button
                    onClick={() => onZoneAction && onZoneAction(currentZone)}
                    className="px-2 py-0.5 rounded text-xs font-bold transition-all hover:scale-105 active:scale-95"
                    style={{ background: b.topHL+'33', border:`1px solid ${b.topHL}66`, color: b.topHL, cursor: 'pointer' }}>
                    [E] {currentZone.action}
                  </button>
                )}
              </div>
            );
          })()}

          {/* Hover card */}
          {hoveredMember && hoveredMember.id !== controlledMemberId && (() => {
            const tier = getLevelTier(hoveredMember.level);
            return (
              <div className="absolute top-3 left-3 p-3 rounded-xl pointer-events-none"
                style={{ background:'rgba(0,10,30,0.88)', border:`2px solid ${hoveredMember.avatarColor}77`, backdropFilter:'blur(8px)', minWidth:168 }}>
                <div className="font-bold text-sm" style={{ color: hoveredMember.avatarColor }}>{hoveredMember.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{hoveredMember.role}</div>
                <div className="text-xs mt-1.5 font-bold" style={{ color: tier.color }}>Lv{hoveredMember.level} {tier.title}</div>
                <div className="text-xs text-gray-400">{hoveredMember.xp.toLocaleString()} XP</div>
                <div className="flex flex-wrap gap-0.5 mt-1.5">
                  {hoveredMember.badges.slice(0,5).map(b => <span key={b} className="text-base">{BADGE_EMOJI[b]||'🎖️'}</span>)}
                </div>
              </div>
            );
          })()}

          {/* Challenge button — appears when near a teammate */}
          {nearbyMember && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-auto z-20">
              <div className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.75)', border: `1px solid ${nearbyMember.avatarColor}88` }}>
                {nearbyMember.name[0]} {nearbyMember.name} is nearby
              </div>
              <button
                onClick={() => onChallenge && onChallenge(nearbyMember.id)}
                className="px-5 py-2.5 rounded-xl font-black text-white text-sm transition-all hover:scale-110 active:scale-95 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #ff1744, #d50000)', boxShadow: '0 0 20px rgba(255,23,68,0.6)', border: '1px solid rgba(255,100,100,0.4)' }}
              >
                ⚔️ Challenge {nearbyMember.name}
              </button>
            </div>
          )}

          {/* Coin HUD — top left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,214,0,0.3)', backdropFilter: 'blur(4px)' }}>
            <span className="text-base">💰</span>
            <span className="font-black text-yellow-400 text-sm">{playerCoins ?? TEAM_MEMBERS.find(m => m.id === controlledMemberId)?.coins ?? 0}</span>
            <span className="text-[10px] text-yellow-400/60">coins</span>
          </div>

          {/* Controls hint + Help button */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <div className="px-2.5 py-1.5 rounded-lg text-[11px] pointer-events-none hidden sm:block"
              style={{ background:'rgba(0,0,0,0.55)', color:'rgba(255,255,255,0.5)', backdropFilter:'blur(4px)' }}>
              WASD · Arrow Keys
            </div>
            <button
              onClick={() => setShowHelp(v => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white transition-all hover:scale-110"
              style={{ background: showHelp ? 'rgba(99,102,241,0.7)' : 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(4px)' }}>
              ?
            </button>
          </div>

          {/* Help overlay */}
          {showHelp && (
            <div className="absolute inset-0 flex items-center justify-center z-40 p-4"
              style={{ background: 'rgba(0,5,20,0.92)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowHelp(false)}>
              <div className="rounded-2xl p-5 w-full max-w-sm max-h-full overflow-y-auto"
                style={{ background: 'rgba(10,20,50,0.98)', border: '1px solid rgba(99,102,241,0.4)', boxShadow: '0 0 40px rgba(99,102,241,0.2)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-black text-base">🗺️ Mission Control Guide</h3>
                  <button onClick={() => setShowHelp(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
                </div>
                <div className="flex flex-col gap-4 text-xs text-gray-300">
                  <HelpSection title="🕹️ Movement" color="#60a5fa">
                    Use <strong className="text-white">Arrow Keys</strong> or <strong className="text-white">WASD</strong> to walk your character around the map. On mobile, use the <strong className="text-white">D-pad</strong> in the bottom-right corner.
                  </HelpSection>
                  <HelpSection title="🏘️ Biome Zones" color="#a78bfa">
                    <div className="flex flex-col gap-1 mt-1">
                      {[
                        { e:'🟢', n:'Grind Zone', d:'The daily work area. Log sessions and track progress.' },
                        { e:'🟣', n:'Idea Lab', d:'Submit and upvote ideas for the team.' },
                        { e:'🔴', n:'War Room', d:'Battle Arena — challenge teammates to XP duels.' },
                        { e:'🟤', n:'Coffee Corner', d:'Casual hangout. Drop emotes, chat freely.' },
                        { e:'🔵', n:'Watercooler', d:'Team social hub. See who\'s online and what\'s happening.' },
                        { e:'🟡', n:'Trophy Wall', d:'Leaderboard area — check XP rankings and badges.' },
                      ].map(z => (
                        <div key={z.n} className="flex gap-2">
                          <span className="shrink-0 w-4">{z.e}</span>
                          <span><strong className="text-white">{z.n}:</strong> {z.d}</span>
                        </div>
                      ))}
                    </div>
                  </HelpSection>
                  <HelpSection title="⚔️ Arena Battles" color="#f87171">
                    Walk near a teammate to see the <strong className="text-white">Challenge</strong> button. Win battles to earn <strong className="text-white">XP and coins</strong>. Battles are best-of-3 trivia rounds. Your record is tracked on your profile.
                  </HelpSection>
                  <HelpSection title="💬 Chat & Emotes" color="#34d399">
                    Type in the chat bar below the map to send a message to the whole team in real time. Hit the <strong className="text-white">😄</strong> button to fire off a floating emote above your character.
                  </HelpSection>
                  <HelpSection title="⭐ XP & Levels" color="#fbbf24">
                    You earn XP by logging work summaries, winning battles, submitting ideas, and being active. Every level-up unlocks a new <strong className="text-white">tier title</strong> and boosts your leaderboard rank.
                  </HelpSection>
                  <HelpSection title="🏅 Badges" color="#c084fc">
                    Badges are earned by hitting milestones — first login, first idea, first battle win, and more. Day-1 badges are achievable right now. Long-term badges are lifetime goals. Check the <strong className="text-white">Badges tab</strong> for the full list.
                  </HelpSection>
                  <HelpSection title="💡 Ideas Board" color="#38bdf8">
                    Submit feature ideas or projects in the <strong className="text-white">Ideas tab</strong>. Upvote teammates' ideas to push them up the list. The most-upvoted ideas get attention first.
                  </HelpSection>
                  <HelpSection title="📋 Requests" color="#fb923c">
                    Found a bug or want a new Mission Control feature? Submit it in the <strong className="text-white">Requests tab</strong>. Scott reviews requests nightly and approved ones get built automatically.
                  </HelpSection>
                </div>
                <div className="mt-4 text-center text-[10px] text-gray-600">Click anywhere outside or press ✕ to close</div>
              </div>
            </div>
          )}

          {/* Touch D-pad — mobile only */}
          <div className="absolute bottom-16 right-3 sm:hidden pointer-events-auto select-none z-30">
            <div className="grid gap-1" style={{ gridTemplateColumns: '44px 44px 44px', gridTemplateRows: '44px 44px 44px' }}>
              {/* Row 1: empty, up, empty */}
              <div />
              <DPadBtn label="▲" onPress={() => keysRef.current.add('arrowup')} onRelease={() => { keysRef.current.delete('arrowup'); if(!keysRef.current.size) setPlayerStates(p => ({...p,[controlledMemberId]:{...p[controlledMemberId],moving:false}})); }} />
              <div />
              {/* Row 2: left, empty, right */}
              <DPadBtn label="◀" onPress={() => keysRef.current.add('arrowleft')} onRelease={() => { keysRef.current.delete('arrowleft'); if(!keysRef.current.size) setPlayerStates(p => ({...p,[controlledMemberId]:{...p[controlledMemberId],moving:false}})); }} />
              <div className="rounded-lg" style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.1)' }} />
              <DPadBtn label="▶" onPress={() => keysRef.current.add('arrowright')} onRelease={() => { keysRef.current.delete('arrowright'); if(!keysRef.current.size) setPlayerStates(p => ({...p,[controlledMemberId]:{...p[controlledMemberId],moving:false}})); }} />
              {/* Row 3: empty, down, empty */}
              <div />
              <DPadBtn label="▼" onPress={() => keysRef.current.add('arrowdown')} onRelease={() => { keysRef.current.delete('arrowdown'); if(!keysRef.current.size) setPlayerStates(p => ({...p,[controlledMemberId]:{...p[controlledMemberId],moving:false}})); }} />
              <div />
            </div>
          </div>
        </div>

        {/* Chat */}
        <div className="rounded-xl p-2 flex flex-col gap-1.5" style={{ background:'rgba(0,10,30,0.65)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <div className="overflow-y-auto flex flex-col gap-0.5" style={{ maxHeight: 68 }}>
            {chatMessages.slice(-6).map(msg => {
              const m = members.find(x => x.id === msg.authorId);
              return (
                <div key={msg.id} className="text-xs flex gap-2">
                  <span className="font-bold shrink-0" style={{ color: m?.avatarColor || '#aaa' }}>{m?.name}:</span>
                  <span className="text-gray-300">{msg.text}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowEmotes(v => !v)} className="text-lg px-1.5 py-0.5 rounded-lg hover:bg-white/10 transition-colors">😄</button>
            <input
              className="flex-1 bg-white/5 rounded-lg px-3 py-1.5 text-sm text-white outline-none border border-white/10 focus:border-blue-400/50"
              placeholder="Say something..." value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (() => { if (chatInput.trim()) { onSendChat(chatInput.trim()); setChatInput(''); } })()}
            />
            <button onClick={() => { if (chatInput.trim()) { onSendChat(chatInput.trim()); setChatInput(''); } }}
              className="px-3 py-1.5 rounded-lg text-sm font-bold text-white"
              style={{ background: me.avatarColor, boxShadow:`0 0 8px ${me.avatarColor}55` }}>Send</button>
          </div>
          {showEmotes && (
            <div className="flex flex-wrap gap-1 pt-1">
              {EMOTES.map(e => (
                <button key={e.emoji} onClick={() => sendEmote(e)} title={e.label} className="text-xl p-1 rounded-lg hover:bg-white/10 transition-colors">{e.emoji}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar — hidden on mobile */}
      <div className="hidden sm:flex w-48 flex-col gap-3 shrink-0">
        {/* Online Now */}
        <div className="rounded-xl p-3" style={{ background:'rgba(0,10,30,0.65)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-[10px] font-bold text-blue-300/60 uppercase tracking-wider mb-2">Online Now</div>
          {members.filter(m => m.status !== 'offline').map(m => {
            const tier = getLevelTier(m.level);
            const ps = playerStates[m.id];
            const onCouch = ps ? ZONE_TILE_SET[`${ps.x},${ps.y}`]?.id === 'green_couch' : false;
            return (
              <div key={m.id} className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
                  style={{ background: m.avatarColor, boxShadow:`0 0 6px ${m.avatarColor}77` }}>{m.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                    {m.name}
                    {m.id === controlledMemberId && <span className="text-[9px] text-blue-300/50">(you)</span>}
                  </div>
                  {onCouch
                    ? <div className="text-[9px] text-green-400 font-bold">🛋️ In DOME Meeting</div>
                    : <div className="text-[9px]" style={{ color: tier.color }}>Lv{m.level} {tier.title}</div>
                  }
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${onCouch ? 'bg-green-300' : m.status==='online'?'bg-green-400':'bg-yellow-400'}`}
                  style={onCouch ? {boxShadow:'0 0 8px #69f07a'} : m.status==='online'?{boxShadow:'0 0 5px #69f0ae'}:{}} />
              </div>
            );
          })}
        </div>

        {/* Biomes */}
        <div className="rounded-xl p-3" style={{ background:'rgba(0,10,30,0.65)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-[10px] font-bold text-blue-300/60 uppercase tracking-wider mb-2">Biomes</div>
          {ZONES.map(z => {
            const b = BIOME[z.id] || BIOME.grind_zone;
            return (
              <div key={z.id} className="flex items-center gap-2 mb-1.5">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: b.top, border:`1px solid ${b.topHL}`, boxShadow:`0 0 4px ${b.topHL}66` }} />
                <div className="text-[10px] text-gray-300 truncate">{z.emoji} {z.name}</div>
              </div>
            );
          })}
        </div>

        {/* 🌍 World Lab */}
        <div className="rounded-xl flex-1 flex flex-col overflow-hidden" style={{ background:'rgba(0,10,30,0.65)', border:'1px solid rgba(99,102,241,0.3)' }}>
          <button
            onClick={() => setShowWorldLab(v => !v)}
            className="flex items-center gap-2 px-3 py-2.5 w-full text-left transition-colors hover:bg-white/5"
          >
            <span className="text-base">🌍</span>
            <div className="flex-1">
              <div className="text-[11px] font-bold text-indigo-300">World Lab</div>
              <div className="text-[9px] text-gray-500">Shape the world</div>
            </div>
            <span className="text-gray-500 text-xs">{showWorldLab ? '▲' : '▼'}</span>
          </button>

          {showWorldLab && (
            <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Submit form */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="text-[10px] text-gray-500 leading-relaxed">Submit a world change request. Scott reviews and approves what gets built.</div>
                <input
                  className="w-full bg-black/40 rounded-lg px-2 py-1.5 text-xs text-white outline-none border border-white/10 focus:border-indigo-400/50"
                  placeholder="What do you want to add?"
                  value={wlTitle}
                  onChange={e => setWlTitle(e.target.value)}
                />
                <textarea
                  className="w-full bg-black/40 rounded-lg px-2 py-1.5 text-xs text-white outline-none border border-white/10 focus:border-indigo-400/50 resize-none"
                  placeholder="Describe the idea..."
                  rows={2}
                  value={wlDesc}
                  onChange={e => setWlDesc(e.target.value)}
                />
                <select
                  className="w-full bg-black/40 rounded-lg px-2 py-1.5 text-xs text-gray-300 outline-none border border-white/10"
                  value={wlCategory}
                  onChange={e => setWlCategory(e.target.value as DBWorldRequest['category'])}
                >
                  {(Object.entries(CATEGORY_LABELS) as [DBWorldRequest['category'], string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button
                  onClick={handleWorldLabSubmit}
                  disabled={wlSubmitting || !wlTitle.trim()}
                  className="w-full py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: wlSubmitted ? 'rgba(74,222,128,0.3)' : 'rgba(99,102,241,0.5)', border: `1px solid ${wlSubmitted ? 'rgba(74,222,128,0.5)' : 'rgba(99,102,241,0.7)'}` }}
                >
                  {wlSubmitting ? '...' : wlSubmitted ? '✓ Submitted!' : '🚀 Submit Request'}
                </button>
              </div>

              {/* Recent requests */}
              {worldRequests.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Recent Requests</div>
                  {worldRequests.slice(0, 8).map(req => {
                    const hasVoted = req.upvotes.includes(controlledMemberId);
                    const STATUS_COLOR: Record<string, string> = { open: '#6b7280', approved: '#22c55e', implemented: '#6366f1', declined: '#ef4444' };
                    return (
                      <div key={req.id} className="rounded-lg p-2 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="flex items-start gap-1.5">
                          <button
                            onClick={() => handleWorldUpvote(req)}
                            className="flex flex-col items-center gap-0 shrink-0 px-1 py-0.5 rounded"
                            style={{ background: hasVoted ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)' }}
                          >
                            <span className="text-[10px]">{hasVoted ? '▲' : '△'}</span>
                            <span className="text-[9px] font-bold" style={{ color: hasVoted ? '#a5b4fc' : '#6b7280' }}>{req.upvotes.length}</span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold text-white leading-tight truncate">{req.title}</div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px]" style={{ color: STATUS_COLOR[req.status] || '#6b7280' }}>● {req.status}</span>
                              <span className="text-[9px] text-gray-600">· {CATEGORY_LABELS[req.category]?.split(' ')[0]}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Touch D-pad button ───────────────────────────────────────────────────────
function DPadBtn({ label, onPress, onRelease }: { label: string; onPress: () => void; onRelease: () => void }) {
  return (
    <button
      className="w-full h-full rounded-lg flex items-center justify-center text-white font-bold text-base active:scale-90 transition-transform"
      style={{ background:'rgba(0,0,0,0.55)', border:'1px solid rgba(255,255,255,0.2)', backdropFilter:'blur(4px)', touchAction:'none' }}
      onPointerDown={e => { e.preventDefault(); onPress(); }}
      onPointerUp={e => { e.preventDefault(); onRelease(); }}
      onPointerLeave={e => { e.preventDefault(); onRelease(); }}
    >
      {label}
    </button>
  );
}

function HelpSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-3" style={{ background: `${color}11`, border: `1px solid ${color}33` }}>
      <div className="font-bold text-[11px] mb-1.5" style={{ color }}>{title}</div>
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

const BADGE_EMOJI: Record<string,string> = {
  // Day-1 badges
  pioneer:'🚩', first_steps:'👟', spark:'✨', voter:'🗳️',
  first_blood:'⚔️', request_filed:'📋', brain_initiate:'🧠', word_smith:'📖',
  // Long-term badges
  brain_dump:'🧠', oracle:'🔮', librarian:'📚', project_whisperer:'🏗️',
  dawn_patrol:'🌅', night_owl:'🦉', idea_volcano:'💡', peoples_champion:'👑',
  democracy_enjoyer:'🗳️', hyperdrive:'⚡', hot_streak:'🔥', dome_fossil:'💎',
  galaxy_brained:'🌌', og:'🎯', data_archaeologist:'🔬', overachiever:'🏆',
  dome_legend:'🌟', team_player:'🤝', deep_space:'🚀', speed_demon:'🏎️',
  ghost_protocol:'👻', tumbleweed:'🌵', touch_grass:'☕', chronically_maybe:'🐌', copy_pasta:'🔄',
};
