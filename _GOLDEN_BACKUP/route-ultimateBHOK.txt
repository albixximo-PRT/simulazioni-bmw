import { NextRequest } from "next/server"
import sharp from "sharp"

export const runtime = "nodejs"

/* -------------------- Helpers OCR -------------------- */

const OCR_PRO_ENDPOINTS = [
  "https://apipro1.ocr.space/parse/image",
  "https://apipro2.ocr.space/parse/image",
] as const

type OcrServerLabel = "API PRO 1" | "API PRO 2" | "UNKNOWN"

type OcrAttemptTrace = {
  endpoint: string
  serverUsed: OcrServerLabel
  engine: "1" | "2"
  ok: boolean
  error?: string
}

type OcrConnectionItem = {
  fileIndex: number
  fileName: string
  stage: "base" | "qualiAlt" | "qualiTimes"
  serverUsed: OcrServerLabel
  endpoint: string
  engine: "1" | "2"
}

function endpointToServerLabel(endpoint: string): OcrServerLabel {
  if (endpoint.includes("apipro1")) return "API PRO 1"
  if (endpoint.includes("apipro2")) return "API PRO 2"
  return "UNKNOWN"
}

function normalizeErrorMessage(x: any) {
  if (!x) return ""
  if (Array.isArray(x)) return x.join(" | ")
  if (typeof x === "string") return x
  return JSON.stringify(x)
}

async function fetchWithTimeout(url: string, opts: RequestInit, ms: number) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

async function callOcrSpace(apiKey: string, jpegBuffer: Buffer, engine: "1" | "2") {
  const errors: string[] = []
  const attempts: OcrAttemptTrace[] = []

  for (const endpoint of OCR_PRO_ENDPOINTS) {
    const serverUsed = endpointToServerLabel(endpoint)
    console.log("OCR → tentativo su:", endpoint)

    try {
      const fd = new FormData()
      fd.append("apikey", apiKey)
      fd.append("language", "eng")
      fd.append("OCREngine", engine)
      fd.append("scale", "false")
      fd.append("isTable", "false")
      fd.append("file", new Blob([jpegBuffer], { type: "image/jpeg" }), "gt7.jpg")

      const res = await fetchWithTimeout(
        endpoint,
        { method: "POST", body: fd },
        60000
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.IsErroredOnProcessing) {
        const errMsg = normalizeErrorMessage(data?.ErrorMessage)
        console.log("OCR → errore su", endpoint, errMsg || res.status)
        errors.push(`${endpoint} -> ${errMsg || `HTTP ${res.status}`}`)
        attempts.push({
          endpoint,
          serverUsed,
          engine,
          ok: false,
          error: errMsg || `HTTP ${res.status}`,
        })
        continue
      }

      console.log("OCR → successo su", endpoint)
      attempts.push({
        endpoint,
        serverUsed,
        engine,
        ok: true,
      })

      return { res, data, endpointUsed: endpoint, serverUsed, attempts }
    } catch (err: any) {
      const errMsg = err?.message || String(err)
      console.log("OCR → errore fetch su", endpoint, errMsg)
      errors.push(`${endpoint} -> ${errMsg}`)
      attempts.push({
        endpoint,
        serverUsed,
        engine,
        ok: false,
        error: errMsg,
      })
    }
  }

  return {
    res: new Response(null, { status: 502 }),
    data: {
      IsErroredOnProcessing: true,
      ErrorMessage: `OCR PRO fallita su entrambi gli endpoint: ${errors.join(" || ")}`,
    },
    endpointUsed: "",
    serverUsed: "UNKNOWN" as OcrServerLabel,
    attempts,
  }
}

async function preprocessForOcr(input: Buffer) {
  const img = sharp(input)
  const meta = await img.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0

  if (!w || !h) {
    return await sharp(input)
      .resize({ width: 1100, withoutEnlargement: true })
      .grayscale()
      .jpeg({ quality: 65 })
      .toBuffer()
  }

  const left = Math.round(w * 0.04)
  const right = Math.round(w * 0.04)
  const top = Math.round(h * 0.10)
  const bottom = Math.round(h * 0.12)

  const cropW = Math.max(1, w - left - right)
  const cropH = Math.max(1, h - top - bottom)

  return await sharp(input)
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ width: 1100, withoutEnlargement: true })
    .grayscale()
    .sharpen()
    .jpeg({ quality: 65 })
    .toBuffer()
}

async function preprocessForOcrQualiAlt(input: Buffer) {
  return await sharp(input)
    .resize({ width: 1600, withoutEnlargement: true })
    .grayscale()
    .sharpen()
    .jpeg({ quality: 80 })
    .toBuffer()
}

async function preprocessForOcrQualiTimesOnly(input: Buffer) {
  const img = sharp(input)
  const meta = await img.metadata()
  const w = meta.width ?? 0
  const h = meta.height ?? 0

  if (!w || !h) {
    return await sharp(input)
      .resize({ width: 1800, withoutEnlargement: true })
      .grayscale()
      .sharpen()
      .jpeg({ quality: 85 })
      .toBuffer()
  }

  const left = Math.round(w * 0.02)
  const top = Math.round(h * 0.16)
  const cropW = Math.round(w * 0.96)
  const cropH = Math.round(h * 0.62)

  return await sharp(input)
    .extract({
      left,
      top,
      width: Math.max(1, cropW),
      height: Math.max(1, cropH),
    })
    .resize({ width: 1800, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .jpeg({ quality: 85 })
    .toBuffer()
}

async function ocrWithRetry(apiKey: string, prepped: Buffer) {
  let first = await callOcrSpace(apiKey, prepped, "2")
  let { res, data, endpointUsed, serverUsed } = first
  const attempts: OcrAttemptTrace[] = [...first.attempts]

  const err1 = normalizeErrorMessage(data?.ErrorMessage)
  const bad1 = !res.ok || data?.IsErroredOnProcessing
  const e500_1 = err1.includes("E500") || err1.toLowerCase().includes("resource")
  const e101_1 = err1.includes("E101") || err1.toLowerCase().includes("timed")

  if (bad1 && (e500_1 || e101_1)) {
    const second = await callOcrSpace(apiKey, prepped, "2")
    ;({ res, data, endpointUsed, serverUsed } = second)
    attempts.push(...second.attempts)

    const err2 = normalizeErrorMessage(data?.ErrorMessage)
    const bad2 = !res.ok || data?.IsErroredOnProcessing
    const e500_2 = err2.includes("E500") || err2.toLowerCase().includes("resource")
    const e101_2 = err2.includes("E101") || err2.toLowerCase().includes("timed")

    if (bad2 && (e500_2 || e101_2)) {
      const third = await callOcrSpace(apiKey, prepped, "1")
      ;({ res, data, endpointUsed, serverUsed } = third)
      attempts.push(...third.attempts)
    }
  }

  if (!res.ok || data?.IsErroredOnProcessing) {
    return {
      ok: false as const,
      res,
      data,
      text: "",
      endpointUsed,
      serverUsed,
      attempts,
    }
  }

  const text: string = data?.ParsedResults?.[0]?.ParsedText || ""
  return {
    ok: true as const,
    res,
    data,
    text,
    endpointUsed,
    serverUsed,
    attempts,
  }
}

/* -------------------- Normalization -------------------- */

function normalizePilot(s: string) {
  return String(s || "")
    .replace(/\?/g, "7")
    .replace(/_0I\b/g, "_01")

    // Fix OCR noti
    .replace(/\bPRT[-_]?timmycice\b/gi, "PRT-timmycicc")
    .replace(/\bptroso\b/gi, "ptrbso")
    .replace(/\bneapolis_100\b/gi, "neapolis100")
    .replace(/\bSamueLx\b/gi, "xSamueLx")
    .replace(/\bGabo_Casper85\b/gi, "GaboCasper85")
    .replace(/\bSenpai__ZeN_\b/gi, "Senpai_ZeN_")
    .replace(/\bM__Apex\b/gi, "M_ApeX_")
    .replace(/\bGrollo_?78\b/gi, "Grollo78")
    .replace(/\bZzic3Fr0St--\b/gi, "ZzIc3Fr0St-_-")
    .replace(/\bBOSC_ILMALEDETTO\b/gi, "Bcsc_ILMALEDETTO")
    .trim()
}

function pilotKey(s: string) {
  return normalizePilot(String(s || "").trim().replace(/\s+/g, "_"))
}

function normalizePilotLoose(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "")
    .replace(/-/g, "")
    .replace(/\./g, "")
    .replace(/[’']/g, "")
    .trim()
}

function betterPilotMatch(a: string, b: string) {
  const aa = normalizePilotLoose(a)
  const bb = normalizePilotLoose(b)
  return !!aa && !!bb && aa === bb
}

function cleanCar(s: string) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "'")
    .replace(/\s+'/g, " '")
    .replace(/\*/g, "'")
    .replace(/\b(Megane)\b/gi, "Mégane")
    .replace(/\bHuracan\b/gi, "Huracán")
    .replace(/\bGr ?4\b/gi, "Gr.4")
    .replace(/\bGT ?4\b/gi, "GT4")
    .replace(/\bTC ?'?24\b/gi, "TC '24")
    .replace(/\bTrophy ?'?11\b/gi, "Trophy '11")
    .replace(/\bCup ?'?16\b/gi, "Cup '16")
    .replace(/\bClubsport ?'?16\b/gi, "Clubsport '16")
    .replace(/\(991\)\s*\*?17\b/gi, "(991) '17")
    .replace(/\(992\)\s*22\b/gi, "(992) '22")
    .replace(/\s+\)/g, ")")
    .trim()
}

function csvEscape(v: any) {
  const s = String(v ?? "").replace(/"/g, '""')
  return s.includes(",") ? `"${s}"` : s
}

/* -------------------- Known cars -------------------- */

const KNOWN_CARS = [
  "Cayman GT4 Clubsport '16",
  "Mégane Trophy '11",
  "Swift Sport Gr.4",
  "458 Italia Gr.4",
  "TT Cup '16",
  "4C Gr.4",
  "ELANTRA N TC '24",
  "Huracán Gr.4",
  "NSX Gr.4",
  "Silvia spec-R Aero (S15) Touring Car",
  "Atenza Gr.4",
  "MAZDA3 Gr.4",
  "GT-R Gr.4",
  "650S Gr.4",
  "911 GT3 R (992) '22",
  "911 RSR (991) '17",
  "R8 LMS Evo '19",
  "GR Supra Racing Concept '18",
]

function normalizeCarLoose(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["“”]/g, "'")
    .replace(/\*/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreCarCandidate(raw: string, known: string) {
  const a = normalizeCarLoose(raw)
  const b = normalizeCarLoose(known)

  let score = 0

  if (a === b) score += 100
  if (a.includes(b)) score += 80
  if (b.includes(a) && a.length >= 6) score += 40

  const aWords = new Set(a.split(" "))
  const bWords = b.split(" ")

  for (const w of bWords) {
    if (aWords.has(w)) score += 6
  }

  return score
}

function normalizeKnownCar(raw: string) {
  const s = cleanCar(raw)
  if (!s) return ""

  let best = ""
  let bestScore = 0

  for (const known of KNOWN_CARS) {
    const sc = scoreCarCandidate(s, known)
    if (sc > bestScore) {
      bestScore = sc
      best = known
    }
  }

  return bestScore >= 12 ? best : s
}

function looksLikeKnownCarToken(s: string) {
  const t = normalizeCarLoose(s)
  if (!t) return false

  return (
    t.includes("gr.4") ||
    t.includes("gr4") ||
    t.includes("gt4") ||
    t.includes("clubsport") ||
    t.includes("trophy") ||
    t.includes("italia") ||
    t.includes("elantra") ||
    t.includes("nsx") ||
    t.includes("huracan") ||
    t.includes("mazda3") ||
    t.includes("mazda 3") ||
    t.includes("gt-r") ||
    t.includes("gtr") ||
    t.includes("650s") ||
    t.includes("atenza") ||
    t.includes("silvia") ||
    t.includes("touring car") ||
    t.includes("tt cup") ||
    t.includes("4c") ||
    t.includes("911 gt3 r") ||
    t.includes("911 rsr") ||
    t.includes("r8 lms evo") ||
    t.includes("gr supra racing concept")
  )
}

/* -------------------- Time utils -------------------- */

function normalizeTimeText(s: string) {
  return String(s || "")
    .replace(/[,\u066B]/g, ".")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, "")
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .trim()
}

function isLapTimeStrict(s: string) {
  const t = normalizeTimeText(s)
  return /^\d{1,2}:\d{2}\.\d{3}$/.test(t)
}

function normalizeGapText(s: string) {
  return normalizeTimeText(s)
    .replace(/^\+\./, "+0.")
    .replace(/^\+(\d)\.(\d{3})$/, "+$1.$2")
}

function formatMsToRaceTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0

  const totalSeconds = Math.floor(ms / 1000)
  const milli = ms % 1000

  const ss = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const mm = totalMinutes % 60
  const hh = Math.floor(totalMinutes / 60)

  const pad2 = (n: number) => String(n).padStart(2, "0")
  const pad3 = (n: number) => String(n).padStart(3, "0")

  if (hh > 0) return `${hh}:${pad2(mm)}:${pad2(ss)}.${pad3(milli)}`
  return `${mm}:${pad2(ss)}.${pad3(milli)}`
}

function parseGapToMs(gap: string): number | null {
  const s = normalizeGapText((gap || "").trim())
  if (!s) return null

  const short = s.match(/^\+(\d+)\.(\d{3})$/)
  if (short) {
    const sec = Number(short[1])
    const ms = Number(short[2])
    if ([sec, ms].some(Number.isNaN)) return null
    return sec * 1000 + ms
  }

  const long = s.match(/^\+(\d+):(\d{2})\.(\d{3})$/)
  if (long) {
    const min = Number(long[1])
    const sec = Number(long[2])
    const ms = Number(long[3])
    if ([min, sec, ms].some(Number.isNaN)) return null
    return (min * 60 + sec) * 1000 + ms
  }

  return null
}

function parseLapTimeToMs(s: string): number | null {
  const t = normalizeTimeText((s || "").trim())
  if (!t) return null

  const mmss = t.match(/^(\d{1,2}):(\d{2})\.(\d{3})$/)
  if (mmss) {
    const mm = Number(mmss[1])
    const ss = Number(mmss[2])
    const ms = Number(mmss[3])
    if ([mm, ss, ms].some(Number.isNaN)) return null
    return (mm * 60 + ss) * 1000 + ms
  }

  const hhmmss = t.match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/)
  if (hhmmss) {
    const hh = Number(hhmmss[1])
    const mm = Number(hhmmss[2])
    const ss = Number(hhmmss[3])
    const ms = Number(hhmmss[4])
    if ([hh, mm, ss, ms].some(Number.isNaN)) return null
    return (((hh * 60 + mm) * 60) + ss) * 1000 + ms
  }

  return null
}

/* -------------------- QUALIFICA PARSER -------------------- */

type QualiRow = {
  pos: number
  pilota: string
  auto: string
  tempo: string
  distacco: string
}

function parseQualificaFromColumnText(rawText: string): QualiRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^POLE$/i.test(l))
    .filter((l) => !/^BEST\s*LAP$/i.test(l))
    .filter((l) => !/^DNF$/i.test(l))
    .filter((l) => !/^CHIUDI$/i.test(l))
    .filter((l) => !/^AVANTI$/i.test(l))
    .filter((l) => !/^ALTERNA/i.test(l))

  const findPosBlock = () => {
    const candidates = [1, 9]
    for (const startNum of candidates) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] !== String(startNum)) continue
        let count = 0
        while (count < 8 && lines[i + count] === String(startNum + count)) count++
        if (count >= 2) return { start: i, end: i + count, startNum, count }
      }
    }
    return null
  }

  const posBlock = findPosBlock()
  if (!posBlock) return []

  const count = posBlock.count
  const positions = lines.slice(posBlock.start, posBlock.end).map((x) => Number(x))
  let cursor = posBlock.end

  const isName = (s: string) => {
    const t = String(s || "").trim()
    if (!t) return false
    if (/^\d+$/.test(t)) return false
    if (/^\+/.test(t)) return false
    if (t.includes(":")) return false
    if (/^[\-\.\s]+$/.test(t)) return false
    if (/DISTACCO|MIGLIOR|GRAN|UNION|Dragon|Chiudi|Avanti|Alterna|Blue Moon|Speedway|Interno/i.test(t)) return false
    if (looksLikeKnownCarToken(t)) return false
    return /[A-Za-z]/.test(t)
  }

  const names: string[] = []
  while (cursor < lines.length && names.length < count) {
    const s = lines[cursor]
    if (isName(s)) names.push(normalizePilot(s))
    cursor++
  }
  while (names.length < count) names.push("")

  const isCar = (s: string) => {
    const t = String(s || "").trim()
    if (!t) return false
    if (/MIGLIOR|DISTACCO|GRAN TURISMO|BLUE MOON|SPEEDWAY|INTERNO|CHIUDI|AVANTI|ALTERNA/i.test(t)) return false
    if (/^\d+$/.test(t)) return false
    if (/^\+/.test(t)) return false
    if (t.includes(":")) return false
    if (looksLikeKnownCarToken(t)) return true
    if (/GT3|LMS|RSR/i.test(t)) return true
    if (/'\d{2}/.test(t)) return true
    if (/\(\d{3}\)/.test(t)) return true
    if (/\bGr\.?4\b/i.test(t)) return true
    if (/\bTouring Car\b/i.test(t)) return true
    return false
  }

  const cars: string[] = []
  while (cursor < lines.length && cars.length < count) {
    const s = lines[cursor]
    if (isCar(s)) cars.push(normalizeKnownCar(s))
    cursor++
  }
  while (cars.length < count) cars.push("")

  const isLapTime = (s: string) => isLapTimeStrict(s)
  const times: string[] = []
  while (cursor < lines.length && times.length < count) {
    if (isLapTime(lines[cursor])) times.push(normalizeTimeText(lines[cursor]))
    cursor++
  }
  while (times.length < count) times.push("")

  let gapsRaw: string[] = []
  const idxDistacco = lines.findIndex((l) => /DISTACCO/i.test(l))
  if (idxDistacco !== -1) {
    const after = lines.slice(idxDistacco + 1)
    const gapRegex = /^(--\.\-\-\-|--\.\-\-\-|\+\d{2}\s*\.\s*\d{3}|\+\d+:\d{2}\.\d{3})$/
    gapsRaw = after
      .filter((l) => gapRegex.test(l))
      .map((l) => normalizeGapText(l))
      .slice(0, count)
  }

  let distacchi: string[] = Array(count).fill("")
  const hasLeaderMarker = gapsRaw.some((g) => g.startsWith("--"))
  if (hasLeaderMarker) {
    const onlyPlus = gapsRaw.filter((g) => g.startsWith("+")).slice(0, Math.max(0, count - 1))
    distacchi = [""].concat(onlyPlus)
    while (distacchi.length < count) distacchi.push("")
    distacchi = distacchi.slice(0, count)
  } else {
    distacchi = gapsRaw.slice(0, count)
    while (distacchi.length < count) distacchi.push("")
  }

  const out: QualiRow[] = []
  for (let i = 0; i < count; i++) {
    const pos = positions[i]
    if (!pos || Number.isNaN(pos)) continue
    out.push({
      pos,
      pilota: names[i] ?? "",
      auto: normalizeKnownCar(cars[i] ?? ""),
      tempo: times[i] ?? "",
      distacco: distacchi[i] ?? "",
    })
  }
  return out
}

/* -------------------- UNION ONLY: robust pole from screen 1 -------------------- */

function extractUnionPolePilot(rawText: string): string {
  const parsed = parseQualificaFromColumnText(rawText)
  const p1 = parsed.find((r) => r.pos === 1 && r.pilota)
  if (p1?.pilota) return normalizePilot(p1.pilota)

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^POLE$/i.test(l))
    .filter((l) => !/^BEST\s*LAP$/i.test(l))
    .filter((l) => !/^DNF$/i.test(l))
    .filter((l) => !/^CHIUDI$/i.test(l))
    .filter((l) => !/^AVANTI$/i.test(l))
    .filter((l) => !/^ALTERNA/i.test(l))

  const isName = (s: string) => {
    const t = String(s || "").trim()
    if (!t) return false
    if (/^\d+$/.test(t)) return false
    if (/^\+/.test(t)) return false
    if (t.includes(":")) return false
    if (/^[\-\.\s]+$/.test(t)) return false
    if (/DISTACCO|MIGLIOR|GRAN|UNION|Dragon|Chiudi|Avanti|Alterna|Blue Moon|Speedway|Interno/i.test(t)) return false
    if (looksLikeKnownCarToken(t)) return false
    return /[A-Za-z]/.test(t)
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "1") continue
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      if (isName(lines[j])) return normalizePilot(lines[j])
    }
  }

  return ""
}

function extractQualiTimesByPos(rawText: string) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => normalizeTimeText(l.trim()))
    .filter(Boolean)

  const out = new Map<number, string>()
  const timeRe = /\b(\d{1,2}:\d{2}\.\d{3})\b/

  let pendingPos: number | null = null

  for (const line of lines) {
    const clean = normalizeTimeText(line)

    if (pendingPos != null) {
      const mt = clean.match(timeRe)
      if (mt) {
        if (!out.has(pendingPos)) out.set(pendingPos, normalizeTimeText(mt[1]))
        pendingPos = null
        continue
      }
    }

    const soloNum = clean.match(/^(\d{1,2})$/)
    if (soloNum) {
      const p = Number(soloNum[1])
      if (p >= 1 && p <= 16) pendingPos = p
      continue
    }

    const sameLine = clean.match(/^(\d{1,2})\b.*?(\d{1,2}:\d{2}\.\d{3})/)
    if (sameLine) {
      const p = Number(sameLine[1])
      if (p >= 1 && p <= 16 && !out.has(p)) {
        out.set(p, normalizeTimeText(sameLine[2]))
      }
      pendingPos = null
      continue
    }

    const posOnlyStart = clean.match(/^(\d{1,2})\b/)
    if (posOnlyStart) {
      const p = Number(posOnlyStart[1])
      if (p >= 1 && p <= 16) pendingPos = p
    }
  }

  return out
}

function mergeQualiPosMaps(...maps: Map<number, string>[]) {
  const out = new Map<number, string>()
  for (const m of maps) {
    for (const [pos, tempo] of m.entries()) {
      if (!out.has(pos) && tempo) out.set(pos, tempo)
    }
  }
  return out
}

function mergeQualiRowSafe(map: Map<number, QualiRow>, incoming: QualiRow) {
  const existing = map.get(incoming.pos)

  const cleanedIncoming: QualiRow = {
    ...incoming,
    pilota: normalizePilot(incoming.pilota || ""),
    auto: normalizeKnownCar(incoming.auto || ""),
    tempo: normalizeTimeText((incoming.tempo || "").trim()),
    distacco: normalizeGapText((incoming.distacco || "").trim()),
  }

  if (!existing) {
    map.set(incoming.pos, cleanedIncoming)
    return
  }

  const merged: QualiRow = {
    pos: existing.pos,
    pilota:
      existing.pilota && existing.pilota.trim().length > 0
        ? existing.pilota
        : cleanedIncoming.pilota,
    auto:
      existing.auto && existing.auto.trim().length > 0
        ? existing.auto
        : cleanedIncoming.auto,
    tempo:
      existing.tempo && existing.tempo.trim().length > 0
        ? existing.tempo
        : cleanedIncoming.tempo,
    distacco:
      existing.distacco && existing.distacco.trim().length > 0
        ? existing.distacco
        : cleanedIncoming.distacco,
  }

  map.set(incoming.pos, merged)
}

/* -------------------- GARA PARSER -------------------- */

type RaceRow = {
  pos: number
  pilota: string
  auto: string
  tempoTotale: string
  distacco: string
  migliorGiro: string
}

function takeBlock(lines: string[], headerIdx: number, stopRe: RegExp, n: number) {
  if (headerIdx === -1) return [] as string[]
  const out: string[] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const s = lines[i].trim()
    if (!s) continue
    if (stopRe.test(s)) break
    out.push(s)
    if (out.length >= n) break
  }
  return out
}

function parseGaraFromColumnText(rawText: string): RaceRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const startCandidates = [1, 9]
  let startIndex = -1
  let startNum = 0
  for (const s of startCandidates) {
    const idx = lines.findIndex((l) => l === String(s))
    if (idx !== -1) {
      startIndex = idx
      startNum = s
      break
    }
  }
  if (startIndex === -1) return []

  const positions: number[] = []
  let cursor = startIndex
  let expected = startNum

  while (cursor < lines.length) {
    if (lines[cursor] === String(expected)) {
      positions.push(expected)
      expected++
      cursor++
      if (positions.length >= 16) break
      continue
    }
    if (/TEMPO|PENALIT|MIGLIOR\s+GIRO/i.test(lines[cursor])) break
    cursor++
    if (positions.length > 0 && cursor - startIndex > 80) break
  }
  if (!positions.length) return []

  const lastPos = positions[positions.length - 1]
  const lastPosIdx = lines.findIndex((l, i) => i >= startIndex && l === String(lastPos))
  cursor = lastPosIdx === -1 ? startIndex : lastPosIdx + 1

  const n = positions.length

  const idxTempo = lines.findIndex((l) => /^TEMPO$/i.test(l) || /TEMPO/i.test(l))
  const idxPen = lines.findIndex((l) => /PENALIT/i.test(l))
  const idxBest = lines.findIndex((l) => /MIGLIOR\s+GIRO/i.test(l))

  const stopAnyHeader = /^(TEMPO|PENALITÀ|PENALITA|MIGLIOR\s+GIRO)$/i

  const isName = (s: string) => {
    const t = String(s || "").trim()

    if (!t) return false
    if (/^\d+$/.test(t)) return false
    if (stopAnyHeader.test(t)) return false
    if (t.includes(":")) return false
    if (/^\+/.test(t)) return false
    if (/^[\-\.\s]+$/.test(t)) return false
    if (looksLikeKnownCarToken(t)) return false
    if (/\(\d{3}\)/.test(t)) return false
    if (/'\d{2}\b/.test(t)) return false

    return /[A-Za-z]/.test(t)
  }

  const names: string[] = []
  while (cursor < lines.length && names.length < n) {
    const s = lines[cursor]
    if (isName(s)) names.push(normalizePilot(s.replace(/\s+/g, "_")))
    cursor++
    if (idxTempo !== -1 && cursor >= idxTempo) break
  }
  while (names.length < n) names.push("")

  const carsEnd = idxTempo !== -1 ? idxTempo : idxPen !== -1 ? idxPen : idxBest !== -1 ? idxBest : lines.length
  const carTokens = lines
    .slice(cursor, carsEnd)
    .filter((s) => !stopAnyHeader.test(s))
    .filter((s) => !/Blue Moon|Speedway|Interno|Chiudi|Avanti|Alterna/i.test(s))

  const looksLikeModel = (s: string) => {
    const t = normalizeCarLoose(s)
    return (
      /\b(gt3|rsr|lms|evo)\b/i.test(t) ||
      /\br8\b/i.test(t) ||
      /\b911\b/i.test(t) ||
      t.includes("gr.4") ||
      t.includes("gr4") ||
      t.includes("gt4") ||
      t.includes("clubsport") ||
      t.includes("trophy") ||
      t.includes("italia") ||
      t.includes("elantra") ||
      t.includes("nsx") ||
      t.includes("huracan") ||
      t.includes("mazda3") ||
      t.includes("mazda 3") ||
      t.includes("gtr") ||
      t.includes("gt-r") ||
      t.includes("650s") ||
      t.includes("atenza") ||
      t.includes("silvia") ||
      t.includes("touring car") ||
      t.includes("tt cup") ||
      t === "4c" ||
      t.startsWith("4c ") ||
      t.includes("911 gt3 r") ||
      t.includes("911 rsr") ||
      t.includes("r8 lms evo") ||
      t.includes("gr supra racing concept")
    )
  }

  const hasId = (s: string) =>
    /\(\d{3}\)/.test(s) || /'\d{2}\b/.test(s) || /\b\d{2}\b/.test(s) || /\bGr\.?4\b/i.test(s)

  const isCompleteCar = (s: string) => looksLikeModel(s) && hasId(s)

  const looksLikeCarStart = (tok: string) => {
    const t = normalizeCarLoose(tok)
    return (
      t === "911" ||
      t === "r8" ||
      /^911\b/.test(t) ||
      /^r8\b/.test(t) ||
      /\blms\b/i.test(t) ||
      /\brsr\b/i.test(t) ||
      /\bgt3\b/i.test(t) ||
      t.includes("cayman") ||
      t.includes("megane") ||
      t.includes("mégane") ||
      t.includes("swift") ||
      t.includes("458") ||
      t.includes("tt") ||
      t === "4c" ||
      t.includes("elantra") ||
      t.includes("huracan") ||
      t.includes("huracán") ||
      t.includes("nsx") ||
      t.includes("silvia") ||
      t.includes("atenza") ||
      t.includes("mazda3") ||
      t.includes("mazda 3") ||
      t.includes("gt-r") ||
      t.includes("gtr") ||
      t.includes("650s") ||
      t.includes("gr supra") ||
      t.includes("911 gt3") ||
      t.includes("911 rsr") ||
      t.includes("r8 lms")
    )
  }

  const cars: string[] = []
  let currentParts: string[] = []

  const flush = () => {
    const raw = cleanCar(currentParts.join(" "))
    cars.push(normalizeKnownCar(raw))
    currentParts = []
  }

  for (let i = 0; i < carTokens.length; i++) {
    const tok = carTokens[i]

    if (currentParts.length > 0) {
      const curr = cleanCar(currentParts.join(" "))
      const currHasSomething = looksLikeModel(curr) || hasId(curr)
      if (looksLikeCarStart(tok) && currHasSomething && isCompleteCar(curr)) {
        flush()
      }
    }

    currentParts.push(tok)

    const now = cleanCar(currentParts.join(" "))
    if (isCompleteCar(now)) {
      const next = carTokens[i + 1]?.trim() ?? ""
      const nextIsYear = /^'?\d{2}$/.test(next)
      if (nextIsYear) {
        currentParts.push(next)
        i++
      }
      flush()
    }
  }
  if (currentParts.length) flush()

  while (cars.length < n) cars.push("")
  if (cars.length > n) cars.length = n

  const tempoRaw = takeBlock(lines, idxTempo, /^(PENALITÀ|PENALITA|MIGLIOR\s+GIRO)$/i, n)

  const bestRaw = takeBlock(lines, idxBest, /^(TEMPO|PENALITÀ|PENALITA)$/i, n).map((s) => {
    const m = s.match(/^(\d:\d{2}\.\d{3}|--:--\.\-\-)/)
    return (m?.[1] ?? s).trim()
  })
  const best = bestRaw.map((s) => (s.startsWith("--") ? "" : normalizeTimeText(s)))

  const out: RaceRow[] = []

  for (let i = 0; i < n; i++) {
    const pos = positions[i]
    const pilota = names[i] ?? ""
    const auto = normalizeKnownCar(cars[i] ?? "")
    const tempoCell = normalizeTimeText((tempoRaw[i] ?? "").trim())

    let tempoTotale = ""
    let distacco = ""

    if (pos === 1) {
      if (/^(?:\d+:)?\d{1,2}:\d{2}\.\d{3}$/.test(tempoCell)) tempoTotale = tempoCell
      distacco = ""
    } else {
      if (tempoCell.startsWith("+")) {
        distacco = tempoCell
      } else if (/in\s+gara/i.test(tempoCell)) {
        distacco = "BOX"
      } else {
        const giroMatch = tempoCell.match(/^(\d+)\s*giro/i) || tempoCell.match(/^(\d+)\s*giri/i)
        if (giroMatch) distacco = `${giroMatch[1]}giro`
        else if (/non\s*finito/i.test(tempoCell)) distacco = "DNF"
        else if (/doppiato/i.test(tempoCell)) distacco = "1giro"
        else distacco = tempoCell
      }
    }

    out.push({
      pos,
      pilota,
      auto,
      tempoTotale,
      distacco,
      migliorGiro: best[i] ?? "",
    })
  }

  return out
}

/* -------------------- Classification -------------------- */

function classifyText(text: string): "quali" | "race" | "unknown" {
  const t = (text || "").toUpperCase()
  const isQuali = t.includes("DISTACCO") && t.includes("MIGLIOR GIRO")
  const isRace = t.includes("TEMPO") && (t.includes("PENALIT") || t.includes("PENALITA")) && t.includes("MIGLIOR GIRO")
  if (isQuali && !isRace) return "quali"
  if (isRace) return "race"
  if (t.includes("DISTACCO")) return "quali"
  if (t.includes("PENALIT") || t.includes("NON FINITO") || t.includes("IN GARA") || t.includes("DOPPIATO")) return "race"
  return "unknown"
}

/* -------------------- Final CSV -------------------- */

type ExtractRow = {
  posGara: number
  pilota: string
  auto: string
  tempoTotaleGara: string
  distaccoDalPrimo: string
  migliorGiroGara: string
  tempoQualifica: string
  pole: string
}

type UnionMeta = {
  gara: string
  lobby: string
  lega: string
}

type UnionCsvRow = {
  posizione: number
  nomePilota: string
  auto: string
  distacchi: string
  pp: string
  gv: string
  gara: string
  lobby: string
  lega: string
}

function normalizeLeague(raw: string, unionMode: boolean) {
  const s = (raw || "").toUpperCase().replace(/\s+/g, " ").trim()

  if (unionMode) {
    if (/(^|\b)PRO[\s\-_]?GOLD(\b|$)/i.test(s)) return "PRO-GOLD"
    if (/(^|\b)PRO[\s\-_]?SILVER(\b|$)/i.test(s)) return "PRO-SILVER"
    if (/(^|\b)PRO[\s\-_]?AMA(\b|$)/i.test(s)) return "PRO-AMA"
    if (/(^|\b)STAR(\b|$)/i.test(s)) return "STAR"
    if (/(^|\b)ELITE(\b|$)/i.test(s)) return "ELITE"
    if (/(^|\b)AMA(\b|$)/i.test(s)) return "AMA"
    return ""
  }

  if (/(^|\b)ELITE(\b|$)/i.test(s)) return "ELITE"
  if (/(^|\b)PLATINUM(\b|$)/i.test(s)) return "PLATINUM"
  if (/(^|\b)MASTER(\b|$)/i.test(s)) return "MASTER"
  if (/(^|\b)PRO(\b|$)/i.test(s)) return "PRO"
  if (/(^|\b)GT(\b|$)/i.test(s)) return "GT"
  return ""
}

function extractMetaFromText(text: string, unionMode: boolean): Partial<UnionMeta> {
  const raw = String(text || "")
  const upper = raw.toUpperCase()

  let gara = ""
  let lobby = ""
  let lega = ""

  const garaMatch =
    upper.match(/\bGARA\s*([1-9]\d?)\b/) ||
    upper.match(/\bR(?:OUND)?\s*([1-9]\d?)\b/)
  if (garaMatch) gara = garaMatch[1]

  const lobbyMatch =
    upper.match(/\bLOBBY\s*A?\s*0?(\d{1,2})\b/) ||
    upper.match(/\bA0?(\d{1,2})\b/)
  if (lobbyMatch) {
    lobby = `A${String(Number(lobbyMatch[1])).padStart(2, "0")}`
  }

  const legaCandidates = unionMode
    ? [
        "PRO GOLD",
        "PRO-GOLD",
        "PRO_GOLD",
        "PRO SILVER",
        "PRO-SILVER",
        "PRO_SILVER",
        "PRO AMA",
        "PRO-AMA",
        "PRO_AMA",
        "STAR",
        "ELITE",
        "AMA",
      ]
    : [
        "ELITE",
        "PLATINUM",
        "MASTER",
        "PRO",
        "GT",
      ]

  for (const c of legaCandidates) {
    if (upper.includes(c)) {
      lega = normalizeLeague(c, unionMode)
      break
    }
  }

  return { gara, lobby, lega }
}

function mergeMeta(texts: string[], unionMode: boolean): UnionMeta {
  let gara = ""
  let lobby = ""
  let lega = ""

  for (const text of texts) {
    const meta = extractMetaFromText(text, unionMode)
    if (!gara && meta.gara) gara = meta.gara
    if (!lobby && meta.lobby) lobby = meta.lobby
    if (!lega && meta.lega) lega = meta.lega
    if (gara && lobby && lega) break
  }

  return { gara, lobby, lega }
}

function toUnionCsv(rows: UnionCsvRow[]) {
  const header = ["#", "Nome pilota", "Auto", "Distacchi", "-PP-", "-GV-", "Gara", "Lobby", "Lega"]
  const body = rows
    .map((r) => [
      r.posizione,
      r.nomePilota,
      r.auto,
      r.distacchi,
      r.pp,
      r.gv,
      r.gara,
      r.lobby,
      r.lega,
    ])
    .map((arr) => arr.map(csvEscape).join(","))
    .join("\n")
  return header + "\n" + body
}

function formatGapMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0

  const totalSeconds = Math.floor(ms / 1000)
  const milli = ms % 1000
  const ss = totalSeconds % 60
  const mm = Math.floor(totalSeconds / 60)

  const pad2 = (n: number) => String(n).padStart(2, "0")
  const pad3 = (n: number) => String(n).padStart(3, "0")

  if (mm > 0) return `+${mm}:${pad2(ss)}.${pad3(milli)}`
  return `+${ss}.${pad3(milli)}`
}

function synthesizeUnionCsvRows(rows: ExtractRow[]): ExtractRow[] {
  if (!rows.length) return rows

  const out = rows.map((r) => ({ ...r }))

  let lastRealGapMs = 0
  let dnfCount = 0
  let boxCount = 0

  for (const r of out) {
    if (r.posGara === 1) continue

    const d = (r.distaccoDalPrimo || "").trim()

    if (d.startsWith("+")) {
      const gapMs = parseGapToMs(d)
      if (gapMs != null) {
        lastRealGapMs = gapMs
        continue
      }
    }

    if (/^\d+giro$/i.test(d)) {
      lastRealGapMs += 10000
      r.distaccoDalPrimo = formatGapMs(lastRealGapMs)
      continue
    }

    if (d.toUpperCase() === "DNF") {
      const abs = 60 * 60 * 1000 + dnfCount * 60 * 1000
      dnfCount++
      r.distaccoDalPrimo = formatMsToRaceTime(abs)
      continue
    }

    if (d.toUpperCase() === "BOX") {
      const abs = 2 * 60 * 60 * 1000 + boxCount * 60 * 1000
      boxCount++
      r.distaccoDalPrimo = formatMsToRaceTime(abs)
      continue
    }
  }

  return out
}

function levenshtein(a: string, b: string) {
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }

  return dp[m][n]
}

function findQualiByPilotLoose(pilota: string, rows: QualiRow[]) {
  const target = normalizePilotLoose(pilota)
  if (!target) return undefined

  for (const q of rows) {
    if (betterPilotMatch(q.pilota, pilota)) return q
  }

  let best: QualiRow | undefined
  let bestScore = Infinity

  for (const q of rows) {
    const cand = normalizePilotLoose(q.pilota)
    if (!cand) continue

    if (cand.includes(target) || target.includes(cand)) {
      const score = Math.abs(cand.length - target.length)
      if (score < bestScore) {
        best = q
        bestScore = score
      }
      continue
    }

    const dist = levenshtein(target, cand)
    const maxLen = Math.max(target.length, cand.length)

    if (
      maxLen >= 6 &&
      (
        dist <= 2 ||
        (dist <= 3 && (target.startsWith(cand.slice(0, 4)) || cand.startsWith(target.slice(0, 4))))
      )
    ) {
      if (dist < bestScore) {
        best = q
        bestScore = dist
      }
    }
  }

  return best
}

function findFastestLapPilot(rows: ExtractRow[]) {
  let bestPilot = ""
  let bestMs: number | null = null

  for (const r of rows) {
    const ms = parseLapTimeToMs(r.migliorGiroGara || "")
    if (ms == null) continue
    if (bestMs == null || ms < bestMs) {
      bestMs = ms
      bestPilot = r.pilota || ""
    }
  }

  return bestPilot
}

function isUnionModeFromForm(formData: FormData) {
  const unionModeRaw = String(formData.get("unionMode") || "").toLowerCase().trim()
  const unionRaw = String(formData.get("union") || "").toLowerCase().trim()
  const modeRaw = String(formData.get("mode") || "").toLowerCase().trim()

  return (
    unionModeRaw === "true" ||
    unionModeRaw === "1" ||
    unionRaw === "true" ||
    unionRaw === "1" ||
    modeRaw === "union"
  )
}

/* -------------------- Route Handler -------------------- */

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll("files").filter(Boolean) as File[]
    const unionMode = isUnionModeFromForm(formData)

    if (!files.length) {
      return Response.json({ error: "Nessun file ricevuto" }, { status: 400 })
    }

    const apiKey = process.env.OCR_SPACE_API_KEY
    if (!apiKey) {
      return Response.json({ error: "Manca OCR_SPACE_API_KEY in env" }, { status: 500 })
    }

    const debugChunks: string[] = []
    const allTexts: string[] = []
    const qualiRowsMerged = new Map<number, QualiRow>()
    const raceRowsMerged = new Map<number, RaceRow>()
    const qualiTexts: string[] = []
    const qualiTimesOnlyTexts: string[] = []
    const ocrConnections: OcrConnectionItem[] = []
    let polePilot = ""

    for (let idx = 0; idx < files.length; idx++) {
      const f = files[idx]
      const input = Buffer.from(await f.arrayBuffer())
      const prepped = await preprocessForOcr(input)

      const ocr = await ocrWithRetry(apiKey, prepped)
      if (!ocr.ok) {
        return Response.json(
          {
            error: "OCR.space error",
            httpStatus: ocr.res.status,
            serverUsed: ocr.serverUsed,
            endpointUsed: ocr.endpointUsed,
            ocrAttempts: ocr.attempts,
            ocrStatus: {
              IsErroredOnProcessing: ocr.data?.IsErroredOnProcessing,
              ErrorMessage: ocr.data?.ErrorMessage,
              ErrorDetails: ocr.data?.ErrorDetails,
            },
          },
          { status: 502 }
        )
      }

      if (ocr.endpointUsed) {
        ocrConnections.push({
          fileIndex: idx + 1,
          fileName: f.name,
          stage: "base",
          serverUsed: ocr.serverUsed,
          endpoint: ocr.endpointUsed,
          engine: "2",
        })
      }

      const text = ocr.text
      allTexts.push(text)

      // UNION ONLY: il primo file è autoritativo per la PP
      if (unionMode && idx === 0 && !polePilot) {
        polePilot = extractUnionPolePilot(text)
      }

      const kind = classifyText(text)
      const U = (text || "").toUpperCase()
      const hasRaceHeaders = U.includes("TEMPO") || U.includes("PENALIT") || U.includes("PENALITA") || U.includes("DOPPIATO")

      debugChunks.push(`FILE #${idx + 1} (${kind.toUpperCase()}) — ${f.name}\n\n${text}`)

      if (kind === "quali") {
        if (unionMode) {
          // UNION: uso la qualifica solo per prendere il P1 del primo screen utile
          if (!polePilot) {
            const p1 = extractUnionPolePilot(text)
            if (p1) polePilot = p1
          }
        } else {
          // PRT: invariato
          qualiTexts.push(text)

          const part = parseQualificaFromColumnText(text)
          if (!polePilot) {
            const p1 = part.find((r) => r.pos === 1 && r.pilota)
            if (p1?.pilota) polePilot = p1.pilota
          }
          for (const r of part) {
            mergeQualiRowSafe(qualiRowsMerged, r)
          }

          const preppedAlt = await preprocessForOcrQualiAlt(input)
          const ocrAlt = await ocrWithRetry(apiKey, preppedAlt)
          if (ocrAlt.ok) {
            if (ocrAlt.endpointUsed) {
              ocrConnections.push({
                fileIndex: idx + 1,
                fileName: f.name,
                stage: "qualiAlt",
                serverUsed: ocrAlt.serverUsed,
                endpoint: ocrAlt.endpointUsed,
                engine: "2",
              })
            }

            const textAlt = ocrAlt.text
            qualiTexts.push(textAlt)

            const partAlt = parseQualificaFromColumnText(textAlt)
            if (!polePilot) {
              const p1Alt = partAlt.find((r) => r.pos === 1 && r.pilota)
              if (p1Alt?.pilota) polePilot = p1Alt.pilota
            }

            for (const r of partAlt) {
              mergeQualiRowSafe(qualiRowsMerged, r)
            }

            debugChunks.push(`FILE #${idx + 1} QUALI ALT — ${f.name}\n\n${textAlt}`)
          }

          const preppedTimes = await preprocessForOcrQualiTimesOnly(input)
          const ocrTimes = await ocrWithRetry(apiKey, preppedTimes)
          if (ocrTimes.ok) {
            if (ocrTimes.endpointUsed) {
              ocrConnections.push({
                fileIndex: idx + 1,
                fileName: f.name,
                stage: "qualiTimes",
                serverUsed: ocrTimes.serverUsed,
                endpoint: ocrTimes.endpointUsed,
                engine: "2",
              })
            }

            const textTimes = ocrTimes.text
            qualiTexts.push(textTimes)
            qualiTimesOnlyTexts.push(textTimes)
            debugChunks.push(`FILE #${idx + 1} QUALI TIMES ONLY — ${f.name}\n\n${textTimes}`)
          }
        }
      } else if (kind === "race") {
        const part = parseGaraFromColumnText(text)
        for (const r of part) {
          raceRowsMerged.set(r.pos, { ...r, auto: normalizeKnownCar(r.auto) })
        }
      } else {
        const q = parseQualificaFromColumnText(text)
        const g = hasRaceHeaders ? parseGaraFromColumnText(text) : []

        if (!hasRaceHeaders) {
          if (unionMode) {
            if (!polePilot) {
              const p1 = extractUnionPolePilot(text)
              if (p1) polePilot = p1
            }
          } else {
            qualiTexts.push(text)

            if (!polePilot) {
              const p1 = q.find((r) => r.pos === 1 && r.pilota)
              if (p1?.pilota) polePilot = p1.pilota
            }

            for (const r of q) {
              mergeQualiRowSafe(qualiRowsMerged, r)
            }

            const preppedAlt = await preprocessForOcrQualiAlt(input)
            const ocrAlt = await ocrWithRetry(apiKey, preppedAlt)
            if (ocrAlt.ok) {
              if (ocrAlt.endpointUsed) {
                ocrConnections.push({
                  fileIndex: idx + 1,
                  fileName: f.name,
                  stage: "qualiAlt",
                  serverUsed: ocrAlt.serverUsed,
                  endpoint: ocrAlt.endpointUsed,
                  engine: "2",
                })
              }

              const textAlt = ocrAlt.text
              qualiTexts.push(textAlt)

              const partAlt = parseQualificaFromColumnText(textAlt)
              if (!polePilot) {
                const p1Alt = partAlt.find((r) => r.pos === 1 && r.pilota)
                if (p1Alt?.pilota) polePilot = p1Alt.pilota
              }

              for (const r of partAlt) {
                mergeQualiRowSafe(qualiRowsMerged, r)
              }

              debugChunks.push(`FILE #${idx + 1} QUALI ALT UNKNOWN — ${f.name}\n\n${textAlt}`)
            }

            const preppedTimes = await preprocessForOcrQualiTimesOnly(input)
            const ocrTimes = await ocrWithRetry(apiKey, preppedTimes)
            if (ocrTimes.ok) {
              if (ocrTimes.endpointUsed) {
                ocrConnections.push({
                  fileIndex: idx + 1,
                  fileName: f.name,
                  stage: "qualiTimes",
                  serverUsed: ocrTimes.serverUsed,
                  endpoint: ocrTimes.endpointUsed,
                  engine: "2",
                })
              }

              const textTimes = ocrTimes.text
              qualiTexts.push(textTimes)
              qualiTimesOnlyTexts.push(textTimes)
              debugChunks.push(`FILE #${idx + 1} QUALI TIMES ONLY UNKNOWN — ${f.name}\n\n${textTimes}`)
            }
          }
        } else if (g.length >= q.length && g.length > 0) {
          for (const r of g) {
            raceRowsMerged.set(r.pos, { ...r, auto: normalizeKnownCar(r.auto) })
          }
        } else {
          if (unionMode) {
            if (!polePilot) {
              const p1 = extractUnionPolePilot(text)
              if (p1) polePilot = p1
            }
          } else {
            qualiTexts.push(text)

            if (!polePilot) {
              const p1 = q.find((r) => r.pos === 1 && r.pilota)
              if (p1?.pilota) polePilot = p1.pilota
            }

            for (const r of q) {
              mergeQualiRowSafe(qualiRowsMerged, r)
            }

            const preppedAlt = await preprocessForOcrQualiAlt(input)
            const ocrAlt = await ocrWithRetry(apiKey, preppedAlt)
            if (ocrAlt.ok) {
              if (ocrAlt.endpointUsed) {
                ocrConnections.push({
                  fileIndex: idx + 1,
                  fileName: f.name,
                  stage: "qualiAlt",
                  serverUsed: ocrAlt.serverUsed,
                  endpoint: ocrAlt.endpointUsed,
                  engine: "2",
                })
              }

              const textAlt = ocrAlt.text
              qualiTexts.push(textAlt)

              const partAlt = parseQualificaFromColumnText(textAlt)
              if (!polePilot) {
                const p1Alt = partAlt.find((r) => r.pos === 1 && r.pilota)
                if (p1Alt?.pilota) polePilot = p1Alt.pilota
              }

              for (const r of partAlt) {
                mergeQualiRowSafe(qualiRowsMerged, r)
              }

              debugChunks.push(`FILE #${idx + 1} QUALI ALT FALLBACK — ${f.name}\n\n${textAlt}`)
            }

            const preppedTimes = await preprocessForOcrQualiTimesOnly(input)
            const ocrTimes = await ocrWithRetry(apiKey, preppedTimes)
            if (ocrTimes.ok) {
              if (ocrTimes.endpointUsed) {
                ocrConnections.push({
                  fileIndex: idx + 1,
                  fileName: f.name,
                  stage: "qualiTimes",
                  serverUsed: ocrTimes.serverUsed,
                  endpoint: ocrTimes.endpointUsed,
                  engine: "2",
                })
              }

              const textTimes = ocrTimes.text
              qualiTexts.push(textTimes)
              qualiTimesOnlyTexts.push(textTimes)
              debugChunks.push(`FILE #${idx + 1} QUALI TIMES ONLY FALLBACK — ${f.name}\n\n${textTimes}`)
            }
          }
        }
      }
    }

    const qualiRows = Array.from(qualiRowsMerged.values()).sort((a, b) => a.pos - b.pos)
    const raceRows = Array.from(raceRowsMerged.values()).sort((a, b) => a.pos - b.pos)

    if (!raceRows.length) {
      return Response.json(
        {
          error: "Non ho trovato nessuno screen GARA (manca TEMPO/PENALITÀ/MIGLIOR GIRO nel testo OCR).",
          debugText: debugChunks.join("\n\n===== NEXT FILE =====\n\n"),
          ocrConnections,
        },
        { status: 400 }
      )
    }

    const qualiByPilot = new Map<string, QualiRow>()
    for (const q of qualiRows) {
      if (!q.pilota) continue
      qualiByPilot.set(pilotKey(q.pilota), q)
    }

    const qualiByPosDirect = new Map<number, QualiRow>()
    for (const q of qualiRows) {
      qualiByPosDirect.set(q.pos, q)
    }

    const qualiPosMapsTimesOnly = unionMode
      ? []
      : qualiTimesOnlyTexts.map((t) => extractQualiTimesByPos(t))
    const qualiByPosTimesOnly = unionMode
      ? new Map<number, string>()
      : mergeQualiPosMaps(...qualiPosMapsTimesOnly)

    const qualiPosMapsAll = unionMode
      ? []
      : qualiTexts.map((t) => extractQualiTimesByPos(t))
    const qualiByPosAll = unionMode
      ? new Map<number, string>()
      : mergeQualiPosMaps(...qualiPosMapsAll)

    const qualiByPos = unionMode
      ? new Map<number, string>()
      : (qualiByPosTimesOnly.size > 0 ? qualiByPosTimesOnly : qualiByPosAll)

    const outBase: ExtractRow[] = raceRows.map((r) => {
      const k = r.pilota ? pilotKey(r.pilota) : ""

      const qExact = k ? qualiByPilot.get(k) : undefined
      const qLoose = !qExact && r.pilota ? findQualiByPilotLoose(r.pilota, qualiRows) : undefined
      const qPos = qualiByPosDirect.get(r.pos)

      const tempoQualifica = unionMode
        ? ""
        : (
            normalizeTimeText((qExact?.tempo ?? "").trim()) ||
            normalizeTimeText((qLoose?.tempo ?? "").trim()) ||
            normalizeTimeText((qPos?.tempo ?? "").trim()) ||
            normalizeTimeText((qualiByPos.get(r.pos) ?? "").trim()) ||
            ""
          )

      const raceAuto = normalizeKnownCar((r.auto || "").trim())

      // In UNION non usare mai l'auto qualifica per riempire la tabella.
      const qualiAutoByPilot = unionMode
        ? ""
        : normalizeKnownCar(
            (qExact?.auto || "").trim() ||
            (qLoose?.auto || "").trim()
          )

      const isWeakRaceAuto =
        !raceAuto ||
        raceAuto.length < 10 ||
        /^(458|gr\.?4|gt4|trophy '?11|italia|huracán|huracan|cayman|elantra|atenza|silvia)$/i.test(raceAuto)

      const auto = normalizeKnownCar(
        qualiAutoByPilot ||
        (isWeakRaceAuto ? "" : raceAuto) ||
        raceAuto ||
        ""
      )

      const isPole =
        !!polePilot &&
        !!r.pilota &&
        betterPilotMatch(r.pilota, polePilot)

      return {
        posGara: r.pos,
        pilota: r.pilota ?? "",
        auto,
        tempoTotaleGara: r.tempoTotale ?? "",
        distaccoDalPrimo: r.distacco ?? "",
        migliorGiroGara: r.migliorGiro ?? "",
        tempoQualifica,
        pole: isPole ? "POLE" : "",
      }
    })

    const outTable = outBase.map((r) => ({
      ...r,
      tempoTotaleGara: (r.distaccoDalPrimo || "").toUpperCase() === "BOX" ? "BOX" : r.tempoTotaleGara,
    }))

    const unionMeta = mergeMeta(allTexts, unionMode)
    const fastestLapPilot = findFastestLapPilot(outBase)
    const outCsvRows = synthesizeUnionCsvRows(outBase)

    const unionCsvRows: UnionCsvRow[] = outCsvRows.map((r) => {
      const isPole =
        !!r.pole ||
        (
          !!polePilot &&
          !!r.pilota &&
          betterPilotMatch(r.pilota, polePilot)
        )

      const isFastest =
        !!fastestLapPilot &&
        !!r.pilota &&
        betterPilotMatch(r.pilota, fastestLapPilot)

      const distacchiCsv =
        r.posGara === 1
          ? (r.tempoTotaleGara || "").trim()
          : (r.distaccoDalPrimo || "").trim()

      return {
        posizione: r.posGara,
        nomePilota: r.pilota ?? "",
        auto: r.auto ?? "",
        distacchi: distacchiCsv,
        pp: isPole ? "PP" : "",
        gv: isFastest ? "GV" : "",
        gara: unionMeta.gara,
        lobby: unionMeta.lobby,
        lega: unionMeta.lega,
      }
    })

    const csv = toUnionCsv(unionCsvRows)

    const qualiFound = unionMode
      ? 0
      : outTable.filter((r) => (r.tempoQualifica || "").trim().length > 0).length

    const qualiMissing = unionMode
      ? 0
      : Math.max(0, outTable.length - qualiFound)

    const qualiComplete = unionMode
      ? true
      : qualiMissing === 0

    const warning = unionMode
      ? ""
      : (
          qualiComplete
            ? ""
            : `⚠️ Qualifiche incomplete: trovate ${qualiFound} su ${outTable.length}. Controlla e completa manualmente i tempi mancanti prima dell’uso definitivo del CSV.`
        )

    const uniqueServers = Array.from(
      new Set(
        ocrConnections
          .map((item) => item.serverUsed)
          .filter((item) => item && item !== "UNKNOWN")
      )
    )

    const serverUsed =
      uniqueServers.length === 1
        ? uniqueServers[0]
        : uniqueServers.length > 1
          ? "MIXED"
          : "UNKNOWN"

    return Response.json({
      tool: "Albixximo Race Tools — Race CSV Extractor PRO",
      mode: unionMode ? "UNION" : "PRT",
      count: outTable.length,
      rows: outTable,
      csv,
      polePilot,
      unionMeta,
      fastestLapPilot,
      warning,
      serverUsed,
      serversUsed: uniqueServers,
      ocrConnections,
      stats: {
        qualiRows: qualiRows.length,
        raceRows: raceRows.length,
        filesReceived: files.length,
        qualiTexts: qualiTexts.length,
        qualiTimesOnlyTexts: qualiTimesOnlyTexts.length,
        qualiByPos: qualiByPos.size,
        qualiFound,
        qualiMissing,
        qualiComplete,
        gara: unionMeta.gara,
        lobby: unionMeta.lobby,
        lega: unionMeta.lega,
      },
      debugText: debugChunks.join("\n\n===== NEXT FILE =====\n\n"),
    })
  } catch (err: any) {
    const msg = String(err?.name || "") === "AbortError" ? "Timeout chiamata OCR.space" : "Errore server"
    return Response.json(
      { error: msg, details: String(err?.stack || err?.message || err) },
      { status: 500 }
    )
  }
}