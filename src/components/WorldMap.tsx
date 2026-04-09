import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  WORLD_COLS, WORLD_ROWS,
  ZONE_TILE_SET, ZONES, TEAM_MEMBERS, EMOTES, getLevelTier,
} from '../data/gameData';
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
  onChallenge?: (targetId: string) => void;
  chatMessages: { id: string; authorId: string; text: string; createdAt: number }[];
  onSendChat: (text: string) => void;
  playerCoins?: number;
  liveMembers?: import('../types').TeamMember[];
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function WorldMap({ controlledMemberId, onZoneEnter, onChallenge, chatMessages, onSendChat, playerCoins, liveMembers }: WorldMapProps) {
  // Use liveMembers if provided, otherwise fall back to static TEAM_MEMBERS
  const members = liveMembers && liveMembers.length > 0 ? liveMembers : TEAM_MEMBERS;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const animRef = useRef<number>(0);
  const lastMoveRef = useRef<number>(0);
  const tickRef = useRef<number>(0);

  const [chatInput, setChatInput] = useState('');
  const [showEmotes, setShowEmotes] = useState(false);
  const [currentZone, setCurrentZone] = useState<Zone | null>(null);
  const [hoveredMember, setHoveredMember] = useState<TeamMember | null>(null);
  const [nearbyMember, setNearbyMember] = useState<TeamMember | null>(null);

  const camRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const statesRef = useRef<Record<string, PlayerState>>({});

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
      if (KEYS.includes(e.key.toLowerCase())) { e.preventDefault(); keysRef.current.add(e.key.toLowerCase()); }
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
  }, [controlledMemberId]);

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
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 pointer-events-none"
                style={{ background:'rgba(0,0,0,0.8)', border:`2px solid ${b.topHL}88`, boxShadow:`0 0 16px ${b.topHL}44`, backdropFilter:'blur(6px)' }}>
                <span className="text-lg">{currentZone.emoji}</span>
                <span>{currentZone.name}</span>
                {currentZone.action && (
                  <kbd className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: b.topHL+'33', border:`1px solid ${b.topHL}66`, color: b.topHL }}>
                    [E] {currentZone.action}
                  </kbd>
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

          {/* Controls */}
          <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-lg text-[11px] pointer-events-none"
            style={{ background:'rgba(0,0,0,0.55)', color:'rgba(255,255,255,0.5)', backdropFilter:'blur(4px)' }}>
            WASD · Arrow Keys
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

      {/* Right sidebar */}
      <div className="w-44 flex flex-col gap-3 shrink-0">
        <div className="rounded-xl p-3" style={{ background:'rgba(0,10,30,0.65)', border:'1px solid rgba(255,255,255,0.1)' }}>
          <div className="text-[10px] font-bold text-blue-300/60 uppercase tracking-wider mb-2">Online Now</div>
          {members.filter(m => m.status !== 'offline').map(m => {
            const tier = getLevelTier(m.level);
            return (
              <div key={m.id} className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black shrink-0"
                  style={{ background: m.avatarColor, boxShadow:`0 0 6px ${m.avatarColor}77` }}>{m.name[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                    {m.name}
                    {m.id === controlledMemberId && <span className="text-[9px] text-blue-300/50">(you)</span>}
                  </div>
                  <div className="text-[9px]" style={{ color: tier.color }}>Lv{m.level} {tier.title}</div>
                </div>
                <div className={`w-2 h-2 rounded-full shrink-0 ${m.status==='online'?'bg-green-400':'bg-yellow-400'}`}
                  style={m.status==='online'?{boxShadow:'0 0 5px #69f0ae'}:{}} />
              </div>
            );
          })}
        </div>

        <div className="rounded-xl p-3 flex-1" style={{ background:'rgba(0,10,30,0.65)', border:'1px solid rgba(255,255,255,0.1)' }}>
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
      </div>
    </div>
  );
}

const BADGE_EMOJI: Record<string,string> = {
  brain_dump:'🧠', oracle:'🔮', librarian:'📚', project_whisperer:'🏗️',
  dawn_patrol:'🌅', night_owl:'🦉', idea_volcano:'💡', peoples_champion:'👑',
  democracy_enjoyer:'🗳️', hyperdrive:'⚡', hot_streak:'🔥', dome_fossil:'💎',
  galaxy_brained:'🌌', og:'🎯', data_archaeologist:'🔬', overachiever:'🏆',
  dome_legend:'🌟', team_player:'🤝', deep_space:'🚀', speed_demon:'🏎️',
  ghost_protocol:'👻', tumbleweed:'🌵', touch_grass:'☕', chronically_maybe:'🐌', copy_pasta:'🔄',
};
