"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── HSV ↔ HEX converters ────────────────────────────────────────────────────

function hsvToHex(h: number, s: number, v: number): string {
  s /= 100;
  v /= 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const val = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(Math.max(0, Math.min(1, val)) * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

function hexToHsv(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [0, 0, 100];
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : Math.round((d / max) * 100);
  const v = Math.round(max * 100);
  return [h, s, v];
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(80);
  const [val, setVal] = useState(80);
  const [hexInput, setHexInput] = useState(value);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);

  // Sync external value → internal HSV (only on external change)
  useEffect(() => {
    if (value && /^#[0-9a-fA-F]{6}$/.test(value)) {
      const [h, s, v] = hexToHsv(value);
      setHue(h);
      setSat(s);
      setVal(v);
      setHexInput(value);
    }
  }, [value]);

  // Push HSV → parent
  const emit = useCallback(
    (h: number, s: number, v: number) => {
      const hex = hsvToHex(h, s, v);
      setHexInput(hex);
      onChange(hex);
    },
    [onChange]
  );

  // ── SV square interaction ──────────────────────────────────────────────────

  function pickSV(e: React.MouseEvent | MouseEvent) {
    const rect = svRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const newSat = Math.round(x * 100);
    const newVal = Math.round((1 - y) * 100);
    setSat(newSat);
    setVal(newVal);
    emit(hue, newSat, newVal);
  }

  function onSVMouseDown(e: React.MouseEvent) {
    draggingSV.current = true;
    pickSV(e);
  }

  // ── Hue slider interaction ─────────────────────────────────────────────────

  function pickHue(e: React.MouseEvent | MouseEvent) {
    const rect = hueRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newHue = Math.round(x * 360);
    setHue(newHue);
    emit(newHue, sat, val);
  }

  function onHueMouseDown(e: React.MouseEvent) {
    draggingHue.current = true;
    pickHue(e);
  }

  // ── Global mouse move / up ─────────────────────────────────────────────────

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (draggingSV.current) pickSV(e);
      if (draggingHue.current) pickHue(e);
    }
    function onUp() {
      draggingSV.current = false;
      draggingHue.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  // ── Hex input handler ──────────────────────────────────────────────────────

  function onHexChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setHexInput(raw);
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const [h, s, v] = hexToHsv(hex);
      setHue(h);
      setSat(s);
      setVal(v);
      onChange(hex);
    }
  }

  const currentHex = hsvToHex(hue, sat, val);
  const hueColor = hsvToHex(hue, 100, 100);

  // Cursor position on SV square
  const cursorX = `${sat}%`;
  const cursorY = `${100 - val}%`;

  // Cursor position on hue bar
  const hueCursorX = `${(hue / 360) * 100}%`;

  return (
    <div className="space-y-3 select-none" style={{ userSelect: "none" }}>
      {/* SV square */}
      <div
        ref={svRef}
        onMouseDown={onSVMouseDown}
        className="relative w-full rounded-lg cursor-crosshair"
        style={{ height: 160 }}
      >
        {/* Base hue */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{ background: hueColor }}
        />
        {/* White → transparent (saturation) */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{ background: "linear-gradient(to right, #fff, transparent)" }}
        />
        {/* Transparent → black (value) */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{ background: "linear-gradient(to bottom, transparent, #000)" }}
        />
        {/* Cursor */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: cursorX, top: cursorY, background: currentHex }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        onMouseDown={onHueMouseDown}
        className="relative h-4 rounded-full cursor-ew-resize"
        style={{
          background:
            "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
      >
        {/* Cursor */}
        <div
          className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: hueCursorX, background: hueColor }}
        />
      </div>

      {/* Preview + hex input */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl border border-gray-200 shrink-0 shadow-sm"
          style={{ background: currentHex }}
        />
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-0.5">Hex</label>
          <input
            type="text"
            value={hexInput}
            onChange={onHexChange}
            spellCheck={false}
            maxLength={7}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
          />
        </div>
      </div>
    </div>
  );
}
