"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { toPng } from "html-to-image"

type ExtractRow = {
  posGara: number
  pilota: string
  auto: string
  tempoTotaleGara: string
  distaccoDalPrimo: string
  migliorGiroGara: string
  tempoQualifica: string
  pole?: string
}

type DisplayRow = ExtractRow & {
  sourcePosGara: number
}

type UnionMeta = {
  gara: string
  lobby: string
  lega: string
}

type PenaltyEntry = {
  id: string
  code: string
  lap: string
  minute: string
  second: string
}

type PenaltyMap = Record<string, PenaltyEntry[]>
type DnfOverrideValue = "DNF-I" | "DNF-V"
type DnfOverrideMap = Record<string, DnfOverrideValue>

type PenaltyEffect = "time" | "ammonition" | "dsq" | "other"

type PenaltyRule = {
  seconds: number
  effect: PenaltyEffect
  shortLabel: string
}

type MatchFieldStatus = "ok" | "warn" | "error"

type PrtMatchSummary = {
  overallStatus: "ok" | "warn" | "error"
  percentage: number
  fields: {
    posizione: MatchFieldStatus
    pilota: MatchFieldStatus
    auto: MatchFieldStatus
    distacchi: MatchFieldStatus
    pp: MatchFieldStatus
    gv: MatchFieldStatus
    gara: MatchFieldStatus
    lobby: MatchFieldStatus
    lega: MatchFieldStatus
  }
  notes: string[]
}

type TeamEntry = {
  team: string
  lobby1: string
  lobby2: string
  lobby3: string
  rounds: {
    r1: number
    r2: number
    r3: number
    r4: number
  }
  total: number
}

type TeamLookupResult = {
  team: string
  lobby: "lobby1" | "lobby2" | "lobby3"
  lega: "PRO" | "PRO-AMA" | "AMA"
} | null

/* =========================
   BMW TYPES (NEW FOUNDATION)
   ========================= */

type BmwLeagueName = "PRO" | "PRO-AMA" | "AMA"

type BmwDriverStatus =
  | "finish"
  | "dnf-i"
  | "dnf-v"
  | "dnp"
  | "box"

type RoundKey = "r1" | "r2" | "r3" | "r4"

type BmwSprintKey = "sprint1" | "sprint2"

type BmwSprintDriver = {
  driverId: string
  driverName: string
  team: string
  lega: BmwLeagueName | "-"
  lobby: "lobby1" | "lobby2" | "lobby3" | "-"

  position: number | null
  status: BmwDriverStatus

  basePoints: number
  poleBonus: number
  bestLapBonus: number

  totalPoints: number
}

type BmwSprintSnapshot = {
  sprint: BmwSprintKey
  hasQualifying: boolean
  savedAt: string

  finalRows: DisplayRow[]
  finalCsv: string
  unionMeta: UnionMeta

  savedGara: string
  savedLega: string

  winner: string
  bestQuali: string
  bestRaceLap: string

  drivers: BmwSprintDriver[]

  penalties: PenaltyMap
  lapOverrides: Record<string, string>
  dnfOverrides: DnfOverrideMap
  manualPilotOverrides: Record<number, string>
  manualAutoOverrides: Record<number, string>
  manualDistaccoOverrides: Record<number, string>
}

type BmwRoundDriver = {
  driverId: string
  driverName: string
  team: string
  lega: BmwLeagueName | "-"
  lobby: "lobby1" | "lobby2" | "lobby3" | "-"

  sprint1Points: number
  sprint2Points: number

  sprint1Status: BmwDriverStatus | null
  sprint2Status: BmwDriverStatus | null

  bonusCompletion: number

  totalPoints: number
}

type BmwLeagueSnapshotStatus = "empty" | "saved" | "complete"

type BmwLeagueSnapshot = {
  league: BmwLeagueName
  round: RoundKey
  savedAt: string
  status: BmwLeagueSnapshotStatus

  sprint1: BmwSprintSnapshot | null
  sprint2: BmwSprintSnapshot | null

  drivers: BmwRoundDriver[]
}

type BmwTeamRoundResult = {
  team: string
  pro: number
  proAma: number
  ama: number
  total: number
}

type BmwRoundStatus = "open" | "consolidated" | "locked"

type BmwRoundSnapshot = {
  round: RoundKey
  savedAt: string
  updatedAt: string
  status: BmwRoundStatus

  leagues: Partial<Record<BmwLeagueName, BmwLeagueSnapshot>>

  roundTeamResults: BmwTeamRoundResult[]
  generalTeamResults: BmwTeamRoundResult[]
}

type BmwEventStorage = {
  teams: TeamEntry[]
  currentRound: 1 | 2 | 3 | 4
  roundSnapshots: Partial<Record<RoundKey, BmwRoundSnapshot>>
}

type BmwPortableBackup = {
  version: number
  exportedAt: string
  app: "bmw-m2-team-cup"
  data: {
    // BMW championship
    teams: TeamEntry[]
    currentRound: 1 | 2 | 3 | 4
    roundSnapshots: Partial<Record<RoundKey, BmwRoundSnapshot>>
    savedSprintPreviews: {
      sprint1: BmwSprintSnapshot | null
      sprint2: BmwSprintSnapshot | null
    }
    currentSprint: 1 | 2

    // export texts
    exportTexts: {
      mainTitle: string
      sideLabel: string
      subtitle: string
    }

    // live extractor session
    csv: string
    rows: ExtractRow[]
    unionMeta: UnionMeta
    filesMeta: {
      name: string
      size: number
      type: string
      lastModified: number
    }[]

    // ui state
    prtMode: boolean
    unionMode: boolean
    showTable: boolean
    exportMetaInPng: boolean
    manualGaraOverride: string
    manualLegaOverride: string

    // penalties + manual corrections
    penalties: PenaltyMap
    lapOverrides: Record<string, string>
    dnfOverrides: DnfOverrideMap
    manualPilotOverrides: Record<number, string>
    manualAutoOverrides: Record<number, string>
    manualDistaccoOverrides: Record<number, string>
  }
}

/* =========================
   BMW LEGACY COMPATIBILITY
   ========================= */

type BmwRaceStatus = BmwDriverStatus

type BmwPilotRacePoints = {
  pilota: string
  team: string
  lega: BmwLeagueName | "-"
  lobby: "lobby1" | "lobby2" | "lobby3" | "-"
  posGara: number
  status: BmwRaceStatus
  basePoints: number
  poleBonus: number
  bestLapBonus: number
  totalPoints: number
}

type BmwTeamStandingRow = {
  team: string
  pro: number
  proAma: number
  ama: number
  bonus: number
  total: number
}

type BmwRoundLeagueKey = "pro" | "proAma" | "ama"

type BmwRoundLeagueSnapshot = {
  league: BmwRoundLeagueKey
  savedAt: string
  pilotRows: BmwPilotRacePoints[]
  standings: BmwTeamStandingRow[]
}

const BMW_APP_PASSWORD = "Gabus"
const BMW_AUTH_STORAGE_KEY = "albixximo_bmw_authorized"

function statusBadge(status: MatchFieldStatus) {
  if (status === "ok") return "✅"
  if (status === "warn") return "⚠️"
  return "❌"
}

function overallBoxStyle(status: "ok" | "warn" | "error"): React.CSSProperties {
  if (status === "ok") {
    return {
      background: "rgba(34,197,94,0.14)",
      border: "1px solid rgba(34,197,94,0.45)",
      color: "#dcfce7",
    }
  }

  if (status === "warn") {
    return {
      background: "rgba(250,204,21,0.12)",
      border: "1px solid rgba(250,204,21,0.45)",
      color: "#fef3c7",
    }
  }

  return {
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.45)",
    color: "#fee2e2",
  }
}

function matchCellStyle(status: MatchFieldStatus): React.CSSProperties {
  if (status === "ok") {
    return {
      background: "linear-gradient(180deg, rgba(0,255,120,0.18), rgba(0,0,0,0.25))",
      border: "1px solid rgba(0,255,120,0.35)",
      boxShadow: "0 0 12px rgba(0,255,120,0.18)",
      color: "#ecfff5",
    }
  }

  if (status === "warn") {
    return {
      background: "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(0,0,0,0.25))",
      border: "1px solid rgba(255,215,0,0.35)",
      boxShadow: "0 0 12px rgba(255,215,0,0.16)",
      color: "#fff8dc",
    }
  }

  return {
    background: "linear-gradient(180deg, rgba(255,80,80,0.18), rgba(0,0,0,0.25))",
      border: "1px solid rgba(255,80,80,0.35)",
      boxShadow: "0 0 12px rgba(255,80,80,0.14)",
      color: "#fff1f1",
    }
}

const PENALTY_RULES: Record<string, PenaltyRule> = {
  P01: { seconds: 0, effect: "ammonition", shortLabel: "00:00.000" },
  P02: { seconds: 5, effect: "time", shortLabel: "+5s" },
  P03: { seconds: 5, effect: "time", shortLabel: "+5s" },
  P04: { seconds: 10, effect: "time", shortLabel: "+10s" },
  P05: { seconds: 10, effect: "time", shortLabel: "+10s" },
  P06: { seconds: 15, effect: "time", shortLabel: "+15s" },
  P07: { seconds: 15, effect: "time", shortLabel: "+15s" },
  P08: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P09: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P10: { seconds: 25, effect: "time", shortLabel: "+25s" },
  P11: { seconds: 25, effect: "time", shortLabel: "+25s" },
  P12: { seconds: 30, effect: "time", shortLabel: "+30s" },
  P13: { seconds: 30, effect: "time", shortLabel: "+30s" },
  P14: { seconds: 35, effect: "time", shortLabel: "+35s" },
  P15: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P16: { seconds: 0, effect: "dsq", shortLabel: "DSQ" },
  P17: { seconds: 10, effect: "time", shortLabel: "+10s" },
  P18: { seconds: 45, effect: "time", shortLabel: "+45s" },
  P19: { seconds: 5, effect: "time", shortLabel: "+5s" },
  P20: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P21: { seconds: 30, effect: "time", shortLabel: "+30s" },
  P22: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P23: { seconds: 10, effect: "time", shortLabel: "+10s" },
  P24: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P25: { seconds: 0, effect: "ammonition", shortLabel: "00:00.000" },
  P26: { seconds: 5, effect: "time", shortLabel: "+5s" },
  P27: { seconds: 0, effect: "dsq", shortLabel: "DSQ" },
  P28: { seconds: 0, effect: "other", shortLabel: "-" },
  P29: { seconds: 60, effect: "time", shortLabel: "+60s" },
  P30: { seconds: 15, effect: "time", shortLabel: "+15s" },
  P31: { seconds: 0, effect: "ammonition", shortLabel: "00:00.000" },
  P32: { seconds: 60, effect: "time", shortLabel: "+60s" },
  P33: { seconds: 10, effect: "time", shortLabel: "+10s" },
  P34: { seconds: 10, effect: "time", shortLabel: "+10s" },
  P35: { seconds: 0, effect: "dsq", shortLabel: "DSQ" },
  P36: { seconds: 15, effect: "time", shortLabel: "+15s" },
  P37: { seconds: 0, effect: "other", shortLabel: "-" },
  P38: { seconds: 20, effect: "time", shortLabel: "+20s" },
  P39: { seconds: 20, effect: "time", shortLabel: "+20s" },
  DSQ: { seconds: 0, effect: "dsq", shortLabel: "DSQ" },
}

const AMMONITION_CODES = new Set(["P01", "P25", "P31"])
const DSQ_CODES = new Set(["P16", "P27", "P35", "DSQ"])
const BMW_POINTS_BY_POSITION: Record<number, number> = {
  1: 25,
  2: 22,
  3: 19,
  4: 16,
  5: 14,
  6: 12,
  7: 10,
  8: 8,
  9: 6,
  10: 5,
  11: 4,
  12: 3,
  13: 2,
  14: 1,
}

function getBmwPointsForDisplayRow(r: ExtractRow, bestRaceLap: string): number {
  const rawTempo = tempoLikeGt7(r).trim().toUpperCase()

  const isZeroPointsStatus =
  rawTempo === "BOX" ||
  rawTempo === "DNF" ||
  rawTempo === "DNFV" ||
  rawTempo === "DNP" ||
  rawTempo === "DSQ"

  const isPole = (r.pole || "").trim().toUpperCase() === "POLE"

  const bestLapTime = (bestRaceLap.split("  ").pop() || "").trim()
  const isBestLap =
    !!bestLapTime &&
    (r.migliorGiroGara || "").trim() === bestLapTime

  const basePoints = isZeroPointsStatus
    ? 0
    : BMW_POINTS_BY_POSITION[r.posGara] ?? 0

  return basePoints + (isPole ? 1 : 0) + (isBestLap ? 1 : 0)
}

function getPointsForPrtRow(r: ExtractRow, bestRaceLap: string): number {
  return getBmwPointsForDisplayRow(r, bestRaceLap)
}

function ensureLeagueDriversFromTeams(
  rows: DisplayRow[],
  teams: TeamEntry[],
  currentLega: string,
  roundSubstitutes: Record<string, string> = {}
): DisplayRow[] {
  if (!rows.length) return rows

  const normalizeName = (value: string) => {
    let v = String(value || "").trim().toLowerCase()
    v = v.replace(/^prt[\s._-]*/i, "")
    v = v.replace(/[_\-.]/g, "")
    v = v.replace(/\s+/g, "")
    return v
  }

  const normalizedLega = String(currentLega || "").trim().toUpperCase()
  if (!normalizedLega) return rows

  const leagueDrivers =
    normalizedLega === "PRO"
      ? teams.map((team) => String(team.lobby1 || "").trim()).filter(Boolean)
      : normalizedLega === "PRO-AMA"
        ? teams.map((team) => String(team.lobby2 || "").trim()).filter(Boolean)
        : normalizedLega === "AMA"
          ? teams.map((team) => String(team.lobby3 || "").trim()).filter(Boolean)
          : []

  if (leagueDrivers.length === 0) return rows

  const presentNames = new Set(
    rows.map((r) => normalizeName(String(r.pilota || "")))
  )

  const substituteByOfficial = new Map<string, string>()

Object.entries(roundSubstitutes).forEach(([substituteName, officialName]) => {
  substituteByOfficial.set(normalizeName(officialName), substituteName)
})

const leagueDriversWithSubstitutes = leagueDrivers.map((officialName) => {
  return substituteByOfficial.get(normalizeName(officialName)) || officialName
})

const missingDrivers = leagueDriversWithSubstitutes.filter(
  (name) => !presentNames.has(normalizeName(name))
)

  if (missingDrivers.length === 0) return rows

  const lastPos = Math.max(...rows.map((r) => r.posGara || 0), 0)

  const dnpRows: DisplayRow[] = missingDrivers.map((name, i) => ({
    ...(rows[0] || {
      posGara: 0,
      pilota: "",
      auto: "",
      tempoTotaleGara: "",
      distaccoDalPrimo: "",
      migliorGiroGara: "",
      tempoQualifica: "",
      pole: "",
      sourcePosGara: 0,
    }),
    posGara: lastPos + i + 1,
    sourcePosGara: 1000 + lastPos + i + 1,
    pilota: name,
    auto: "",
    tempoTotaleGara: "DNP",
    distaccoDalPrimo: "DNP",
    migliorGiroGara: "",
    tempoQualifica: "",
    pole: "",
  }))

  return [...rows, ...dnpRows]
}

function TableCell({
  children,
  align,
  mono,
  dim,
  style,
  exporting = false,
}: {
  children: React.ReactNode
  align?: "left" | "center" | "right"
  mono?: boolean
  dim?: boolean
  style?: React.CSSProperties
  exporting?: boolean
}) {
  return (
    <td
      style={{
        padding: exporting ? "9px 9px" : "8px 6px",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        textAlign: align ?? "left",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" : undefined,
        fontSize: exporting ? 13 : 12,
        opacity: dim ? 0.75 : 0.95,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {children}
    </td>
  )
}

function parseMmSsMmm(s: string): number | null {
  const m = s.match(/^(\d+):(\d{2})\.(\d{3})$/)
  if (!m) return null
  const mm = Number(m[1])
  const ss = Number(m[2])
  const ms = Number(m[3])
  if ([mm, ss, ms].some(Number.isNaN)) return null
  return (mm * 60 + ss) * 1000 + ms
}

function parseAbsoluteRaceTimeMs(s: string): number | null {
  const t = (s || "").trim()
  if (!t) return null
  if (t.startsWith("+")) return null
  if (/^(DNF|DNFV|BOX|DSQ)$/i.test(t)) return null
  if (/^\d+giro$/i.test(t)) return null

  const hms = t.match(/^(\d+):(\d{2}):(\d{2})\.(\d{3})$/)
  if (hms) {
    const hh = Number(hms[1])
    const mm = Number(hms[2])
    const ss = Number(hms[3])
    const ms = Number(hms[4])
    if ([hh, mm, ss, ms].some(Number.isNaN)) return null
    return (hh * 3600 + mm * 60 + ss) * 1000 + ms
  }

  const msOnly = t.match(/^(\d+):(\d{2})\.(\d{3})$/)
  if (msOnly) {
    const mm = Number(msOnly[1])
    const ss = Number(msOnly[2])
    const ms = Number(msOnly[3])
    if ([mm, ss, ms].some(Number.isNaN)) return null
    return (mm * 60 + ss) * 1000 + ms
  }

  return null
}

function parseGapToMs(s: string): number | null {
  const raw = (s || "").trim()
  if (!raw) return null

  const t = raw.replace(/\s+/g, "")
  if (!t.startsWith("+")) return null

  const body = t.slice(1)

  const mmss = body.match(/^(\d+):(\d{2})\.(\d{3})$/)
  if (mmss) {
    const mm = Number(mmss[1])
    const ss = Number(mmss[2])
    const ms = Number(mmss[3])
    if ([mm, ss, ms].some(Number.isNaN)) return null
    return (mm * 60 + ss) * 1000 + ms
  }

  const ssOnly = body.match(/^(\d{1,2})\.(\d{3})$/)
  if (ssOnly) {
    const ss = Number(ssOnly[1])
    const ms = Number(ssOnly[2])
    if ([ss, ms].some(Number.isNaN)) return null
    return ss * 1000 + ms
  }

  return null
}

function parseManualLeaderGapInputMs(s: string): number | null {
  const t = (s || "").trim()
  if (!t) return null

  const mmss = t.match(/^(\d+):(\d{2})\.(\d{3})$/)
  if (!mmss) return null

  const mm = Number(mmss[1])
  const ss = Number(mmss[2])
  const ms = Number(mmss[3])

  if ([mm, ss, ms].some(Number.isNaN)) return null
  return (mm * 60 + ss) * 1000 + ms
}

function formatAbsoluteRaceTime(ms: number): string {
  const totalMs = Math.max(0, Math.round(ms))
  const hours = Math.floor(totalMs / 3600000)
  const minutes = Math.floor((totalMs % 3600000) / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const millis = totalMs % 1000

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
  }

  const totalMinutes = Math.floor(totalMs / 60000)
  return `${totalMinutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
}

function formatGapFromLeader(ms: number): string {
  const totalMs = Math.max(0, Math.round(ms))
  const totalMinutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const millis = totalMs % 1000

  if (totalMinutes > 0) {
    return `+${totalMinutes}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
  }

  return `+${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`
}

function formatPenaltyDisplay(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds || 0))
  const mm = Math.floor(safe / 60)
  const ss = safe % 60
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.000`
}

function formatPenaltyOptionLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} secondi`

  const mm = Math.floor(seconds / 60)
  const ss = seconds % 60

  if (ss === 0) {
    return mm === 1 ? "1 minuto" : `${mm} minuti`
  }

  if (mm === 1) {
    return `1 minuto e ${ss} secondi`
  }

  return `${mm} minuti e ${ss} secondi`
}

function getPenaltyRule(code: string): PenaltyRule {
  return PENALTY_RULES[code] || { seconds: 0, effect: "other", shortLabel: "-" }
}

function penaltySecondsFromCode(code: string): number {
  return getPenaltyRule(code).seconds
}

function hasDsqPenalty(entries: PenaltyEntry[] = []): boolean {
  return entries.some((entry) => DSQ_CODES.has(entry.code))
}

function hasAmmonitionPenalty(entries: PenaltyEntry[] = []): boolean {
  return entries.some((entry) => AMMONITION_CODES.has(entry.code))
}

function totalPenaltySeconds(entries: PenaltyEntry[] = []): number {
  return entries.reduce((sum, entry) => sum + penaltySecondsFromCode(entry.code), 0)
}

function createPenaltyEntry(): PenaltyEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code: "P01",
    lap: "Lap 01",
    minute: "00",
    second: "00",
  }
}

function formatPenaltyDetail(entry: PenaltyEntry): string {
  if (entry.lap === "Lap -") {
    return `${entry.code} Lap - --:--`
  }

  return `${entry.code} ${entry.lap} ${entry.minute}:${entry.second}`
}

function getPenaltyOptionText(code: string): string {
  const rule = getPenaltyRule(code)

  if (rule.effect === "ammonition") return `${code} (Ammonizione)`
  if (rule.effect === "dsq") return `${code} (DSQ)`
  if (rule.effect === "other") return `${code} (-)`

  return `${code} (${formatPenaltyOptionLabel(rule.seconds)})`
}

function getPenaltyMainDisplay(entries: PenaltyEntry[] = []): {
  kind: "none" | "time" | "ammonition" | "dsq"
  text: string
} {
  if (!entries.length) return { kind: "none", text: "-" }
  if (hasDsqPenalty(entries)) return { kind: "dsq", text: "DSQ" }

  const total = totalPenaltySeconds(entries)
  if (total > 0) return { kind: "time", text: formatPenaltyDisplay(total) }

  if (hasAmmonitionPenalty(entries)) return { kind: "ammonition", text: "00:00.000" }

  return { kind: "none", text: "-" }
}

function tempoLikeGt7(r: ExtractRow) {
  if (r.posGara === 1) return r.tempoTotaleGara || "-"
  return r.distaccoDalPrimo || "-"
}

function normalizePilot(s: string) {
  return (s || "").trim().toLowerCase()
}

function getSavedSourcePos(row: any): number {
  const saved = Number(row?.sourcePosGara)
  if (Number.isFinite(saved) && saved > 0) return saved

  const pos = Number(row?.posGara)
  if (Number.isFinite(pos) && pos > 0) return pos

  return 0
}

function getPrtRowStableKey(sourcePosGara: number) {
  return `row-${sourcePosGara}`
}

function isDoppiatoValue(value: string) {
  const t = (value || "").trim().toUpperCase()
  return /^\d+GIRO$/i.test(t) || t === "DOPPIATO"
}

function parseCsvLine(line: string) {
  const out: string[] = []
  let cur = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === "," && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }

    cur += ch
  }

  out.push(cur)
  return out.map((v) => v.trim())
}

function csvEscape(value: string | number) {
  const s = String(value ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function parseCsvRows(csv: string): ExtractRow[] {
  const text = (csv || "").trim()
  if (!text) return []

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length < 2) return []

  const header = parseCsvLine(lines[0])
  const idx = {
    posGara: header.indexOf("posGara"),
    pilota: header.indexOf("pilota"),
    auto: header.indexOf("auto"),
    tempoTotaleGara: header.indexOf("tempoTotaleGara"),
    distaccoDalPrimo: header.indexOf("distaccoDalPrimo"),
    migliorGiroGara: header.indexOf("migliorGiroGara"),
    tempoQualifica: header.indexOf("tempoQualifica"),
    pole: header.indexOf("pole"),
  }

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const posRaw = idx.posGara >= 0 ? cols[idx.posGara] ?? "" : ""
    const posNum = Number(posRaw)

    return {
      posGara: Number.isFinite(posNum) ? posNum : 0,
      pilota: idx.pilota >= 0 ? cols[idx.pilota] ?? "" : "",
      auto: idx.auto >= 0 ? cols[idx.auto] ?? "" : "",
      tempoTotaleGara: idx.tempoTotaleGara >= 0 ? cols[idx.tempoTotaleGara] ?? "" : "",
      distaccoDalPrimo: idx.distaccoDalPrimo >= 0 ? cols[idx.distaccoDalPrimo] ?? "" : "",
      migliorGiroGara: idx.migliorGiroGara >= 0 ? cols[idx.migliorGiroGara] ?? "" : "",
      tempoQualifica: idx.tempoQualifica >= 0 ? cols[idx.tempoQualifica] ?? "" : "",
      pole: idx.pole >= 0 ? cols[idx.pole] ?? "" : "",
    }
  })
}

function buildCsvFromRows(rows: ExtractRow[], unionMeta: UnionMeta) {
  const header = ["#", "Nome pilota", "Auto", "Distacchi", "-PP-", "-GV-", "Gara", "Lobby", "Lega"]

  const bestRaceLapMs = rows.reduce<number | null>((best, r) => {
    const ms = parseMmSsMmm((r.migliorGiroGara || "").trim())
    if (ms == null) return best
    if (best == null || ms < best) return ms
    return best
  }, null)

  const body = rows.map((r) => {
    const isPole = (r.pole || "").trim().toUpperCase() === "POLE"
    const raceLapMs = parseMmSsMmm((r.migliorGiroGara || "").trim())
    const isBestLap = bestRaceLapMs != null && raceLapMs != null && raceLapMs === bestRaceLapMs

    const distacco =
      r.posGara === 1
        ? (r.tempoTotaleGara || "-")
        : (r.distaccoDalPrimo || "-")

    return [
      csvEscape(r.posGara),
      csvEscape(r.pilota || ""),
      csvEscape(r.auto || ""),
      csvEscape(distacco),
      csvEscape(isPole ? "PP" : ""),
      csvEscape(isBestLap ? "GV" : ""),
      csvEscape(unionMeta.gara || ""),
      csvEscape(unionMeta.lobby || ""),
      csvEscape(unionMeta.lega || ""),
    ].join(",")
  })

  return [header.join(","), ...body].join("\n")
}

function isNonComparableRaceValue(value: string) {
  const t = (value || "").trim()
  if (!t) return true
  if (/^(DNF|DNFV|BOX|DSQ)$/i.test(t)) return true
  if (/^\d+giro$/i.test(t)) return true
  if (/^DOPPIATO$/i.test(t)) return true
  return false
}

function isRowComparable(row: ExtractRow, leaderMs: number | null) {
  if (leaderMs == null) return false

  const tempoShown = tempoLikeGt7(row)
  if (isNonComparableRaceValue(tempoShown)) return false

  if (row.posGara === 1) {
    return parseAbsoluteRaceTimeMs(row.tempoTotaleGara) != null
  }

  const abs = parseAbsoluteRaceTimeMs(row.tempoTotaleGara)
  if (abs != null) return true

  return parseGapToMs(row.distaccoDalPrimo) != null
}

function resolveComparableRaceMs(row: ExtractRow, leaderMs: number) {
  if (row.posGara === 1) {
    return parseAbsoluteRaceTimeMs(row.tempoTotaleGara)
  }

  const abs = parseAbsoluteRaceTimeMs(row.tempoTotaleGara)
  if (abs != null) return abs

  const gap = parseGapToMs(row.distaccoDalPrimo)
  if (gap != null) return leaderMs + gap

  return null
}
function HeaderBadge({
  label,
  value,
  variant,
  exporting = false,
}: {
  label: string
  value: string
  variant: "gold" | "violet" | "silver" | "sprint1" | "sprint2"
  exporting?: boolean
}) {
    const palette =
    variant === "gold"
      ? {
          border: "rgba(255,215,0,0.70)",
          glow: "rgba(255,215,0,0.16)",
          tagBg: "rgba(255,215,0,0.10)",
          tagBorder: "rgba(255,215,0,0.28)",
          tagText: "#ffe58a",
        }
      : variant === "silver"
        ? {
            border: "rgba(210,215,225,0.72)",
            glow: "rgba(210,215,225,0.18)",
            tagBg: "rgba(210,215,225,0.10)",
            tagBorder: "rgba(210,215,225,0.24)",
            tagText: "#f3f6fb",
          }
        : variant === "sprint1"
          ? {
              border: "rgba(56,189,248,0.72)",
              glow: "rgba(56,189,248,0.18)",
              tagBg: "rgba(56,189,248,0.12)",
              tagBorder: "rgba(56,189,248,0.30)",
              tagText: "#d8f3ff",
            }
          : variant === "sprint2"
            ? {
                border: "rgba(37,99,235,0.72)",
                glow: "rgba(37,99,235,0.18)",
                tagBg: "rgba(37,99,235,0.12)",
                tagBorder: "rgba(37,99,235,0.30)",
                tagText: "#dbeafe",
              }
            : {
                border: "rgba(160,90,255,0.70)",
                glow: "rgba(160,90,255,0.14)",
                tagBg: "rgba(160,90,255,0.10)",
                tagBorder: "rgba(160,90,255,0.28)",
                tagText: "#dfc2ff",
              }

  const rawValue = String(value || "").trim()
  const parts = rawValue.split(/\s{2,}/)
  const mainValue = parts[0] || "-"
  const secondaryValue = parts[1] || ""

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: exporting ? 12 : 10,
        flexWrap: "nowrap",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: exporting
            ? variant === "silver"
              ? "10px 16px"
              : "9px 14px"
            : variant === "silver"
              ? "8px 12px"
              : "7px 11px",
          borderRadius: 999,
          border: `1px solid ${palette.border}`,
          background: "rgba(0,0,0,0.20)",
          boxShadow: `0 0 22px ${palette.glow}`,
          color: "white",
          fontWeight: 900,
          fontSize: exporting
            ? variant === "silver"
              ? 15
              : 14
            : variant === "silver"
              ? 13
              : 12,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}
      </span>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: exporting ? 8 : 7,
          color: "white",
          whiteSpace: "nowrap",
          flexShrink: 0,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        <span
          style={{
            fontWeight: 900,
            fontSize: exporting ? 16 : 14,
            letterSpacing: 0.2,
          }}
        >
          {mainValue || "-"}
        </span>

        {secondaryValue ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: exporting ? "4px 10px" : "3px 8px",
              borderRadius: 999,
              background: palette.tagBg,
              border: `1px solid ${palette.tagBorder}`,
              color: palette.tagText,
              fontWeight: 800,
              fontSize: exporting ? 13 : 11,
              letterSpacing: 0.15,
              fontVariantNumeric: "tabular-nums",
              boxShadow: `0 0 12px ${palette.glow}`,
              lineHeight: 1,
            }}
          >
            {secondaryValue}
          </span>
        ) : null}
      </span>
    </div>
  )
}

function Separator({ exporting = false }: { exporting?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 2,
        height: exporting ? 32 : 30,
        margin: exporting ? "0 12px" : "0 10px",
        borderRadius: 2,
        background: "linear-gradient(to bottom, transparent, rgba(210,215,225,0.9), transparent)",
        boxShadow: "0 0 6px rgba(210,215,225,0.35)",
        flexShrink: 0,
      }}
    />
  )
}

function Pill({
  left,
  right,
  variant,
  exporting = false,
}: {
  left: string
  right?: string
  variant: "gold" | "violet" | "orange" | "teal" | "fuchsia" | "dsq"
  exporting?: boolean
}) {
  const styles: Record<typeof variant, React.CSSProperties> = {
    gold: {
      background: "rgba(255,215,0,0.92)",
      border: "1px solid rgba(255,215,0,0.55)",
      boxShadow: "0 0 22px rgba(255,215,0,0.20)",
    },
    violet: {
      background: "rgba(160,90,255,0.92)",
      border: "1px solid rgba(160,90,255,0.55)",
      boxShadow: "0 0 22px rgba(160,90,255,0.18)",
    },
    orange: {
      background: "rgba(255,165,0,0.92)",
      border: "1px solid rgba(255,165,0,0.55)",
      boxShadow: "0 0 22px rgba(255,165,0,0.16)",
    },
    teal: {
      background: "rgba(64,224,208,0.92)",
      border: "1px solid rgba(64,224,208,0.55)",
      boxShadow: "0 0 22px rgba(64,224,208,0.14)",
    },
    fuchsia: {
      background: "rgba(255,0,128,0.92)",
      border: "1px solid rgba(255,0,128,0.55)",
      boxShadow: "0 0 22px rgba(255,0,128,0.18)",
    },
    dsq: {
      background: "rgba(255,0,255,0.92)",
      border: "1px solid rgba(255,0,255,0.60)",
      boxShadow: "0 0 22px rgba(255,0,255,0.30)",
    },
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: exporting ? 12 : 10,
        padding: exporting ? "10px 16px" : "8px 12px",
        borderRadius: 14,
        fontSize: exporting ? 14 : 12,
        fontWeight: 900,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        color: "rgba(0,0,0,0.92)",
        ...styles[variant],
      }}
    >
      <span>{left}</span>
      {right ? (
        <span
          style={{
            paddingLeft: 10,
            borderLeft: "1px solid rgba(0,0,0,0.22)",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            letterSpacing: 0.2,
            textTransform: "none",
            fontSize: exporting ? 15 : 12,
          }}
        >
          {right}
        </span>
      ) : null}
    </span>
  )
}

function PosBadge({ pos }: { pos: number }) {
  const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 24,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.22)",
  fontSize: 14,
  lineHeight: 1,
  userSelect: "none",
}

  if (pos === 1) {
    return (
      <span
        title="P1"
        style={{
          ...base,
          borderColor: "rgba(255,215,0,0.40)",
          boxShadow: "0 0 22px rgba(255,215,0,0.16)",
        }}
      >
        🥇
      </span>
    )
  }

  if (pos === 2) {
    return (
      <span
        title="P2"
        style={{
          ...base,
          borderColor: "rgba(220,220,220,0.30)",
          boxShadow: "0 0 18px rgba(220,220,220,0.10)",
        }}
      >
        🥈
      </span>
    )
  }

  if (pos === 3) {
    return (
      <span
        title="P3"
        style={{
          ...base,
          borderColor: "rgba(205,127,50,0.35)",
          boxShadow: "0 0 18px rgba(205,127,50,0.12)",
        }}
      >
        🥉
      </span>
    )
  }

  return (
    <span
      title={`P${pos}`}
      style={{
        ...base,
        fontSize: 11,
        fontWeight: 900,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        opacity: 0.9,
      }}
    >
      {pos}
    </span>
  )
}

function rowStyleForPos(pos: number, fallback: string): React.CSSProperties {
  if (pos === 1) {
    return {
      background:
        "linear-gradient(90deg, rgba(255,215,0,0.11) 0%, rgba(255,215,0,0.05) 28%, rgba(255,255,255,0.02) 70%)",
    }
  }
  if (pos === 2) {
    return {
      background:
        "linear-gradient(90deg, rgba(220,220,220,0.10) 0%, rgba(220,220,220,0.04) 28%, rgba(255,255,255,0.02) 70%)",
    }
  }
  if (pos === 3) {
    return {
      background:
        "linear-gradient(90deg, rgba(205,127,50,0.12) 0%, rgba(205,127,50,0.05) 28%, rgba(255,255,255,0.02) 70%)",
    }
  }
  return { background: fallback }
}

function renderTempoCell(tempo: string) {
  const t = (tempo || "").trim()
  const upper = t.toUpperCase()

  if (!t || t === "-") return "-"

  if (upper === "DNF" || upper === "DNF-I") return <Pill left="DNF-I" variant="teal" />
if (upper === "DNFV" || upper === "DNF-V") return <Pill left="DNF-V" variant="teal" />
if (upper === "DNP") return <Pill left="DNP" variant="teal" />
  if (upper === "BOX") return <Pill left="BOX" variant="fuchsia" />
  if (/^\d+giro$/i.test(t) || upper === "DOPPIATO") return <Pill left="DOPPIATO" variant="orange" />
  if (upper === "DSQ") return <Pill left="DSQ" variant="dsq" />

  return t
}

function LegendBare() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 900, letterSpacing: 0.4, textTransform: "uppercase" }}>
        Legenda
      </span>
      <Pill left="POLE" variant="gold" />
      <Pill left="BEST LAP" variant="violet" />
      <Pill left="DOPPIATO" variant="orange" />
      <Pill left="DNF" variant="teal" />
      <Pill left="BOX" variant="fuchsia" />
      <Pill left="DSQ" variant="dsq" />
    </div>
  )
}

function AppHeader({
  mainTitle = "BMW M2 TEAM CUP",
  sideLabel = "Official Timing System",
  subtitle = "Powered by Albixximo",
}: {
  mainTitle?: string
  sideLabel?: string
  subtitle?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 10,
        padding: 12,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
        boxShadow: "0 14px 60px rgba(0,0,0,0.45)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(900px 220px at 10% 10%, rgba(255,215,0,0.18), transparent 60%)," +
            "radial-gradient(700px 220px at 90% 0%, rgba(160,90,255,0.18), transparent 55%)",
          opacity: 0.9,
        }}
      />

      <div style={{ position: "relative", minWidth: 0, flex: 1 }}>
        <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 10,
    rowGap: 8,
    flexWrap: "wrap",
    whiteSpace: "normal",
    minWidth: 0,
  }}
>
  <div
    style={{
      fontSize: "clamp(26px, 3.2vw, 34px)",
      fontWeight: 900,
      letterSpacing: "1px",
      textTransform: "uppercase",
      lineHeight: 1.05,
      textShadow: "0 0 18px rgba(255,215,0,0.22)",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
      flexShrink: 1,
      minWidth: 0,
      maxWidth: "100%",
    }}
  >
    {mainTitle}
  </div>

  <span
    style={{
      fontSize: 14,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(255,255,255,0.06)",
      opacity: 0.95,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      whiteSpace: "normal",
      overflowWrap: "anywhere",
      maxWidth: "100%",
      flexShrink: 0,
    }}
  >
    {sideLabel}
  </span>
</div>

<div
  style={{
    marginTop: 5,
    fontSize: 13,
    opacity: 0.9,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  }}
>
  {subtitle}
</div>

        <div
          style={{
            marginTop: 8,
            height: 7,
            borderRadius: 999,
            background:
              "linear-gradient(90deg, rgba(255,215,0,0.0) 0%, rgba(255,215,0,0.35) 18%, rgba(255,255,255,0.14) 50%, rgba(160,90,255,0.30) 82%, rgba(160,90,255,0.0) 100%)",
            boxShadow: "0 0 18px rgba(255,215,0,0.14)",
            opacity: 0.9,
          }}
        />
      </div>

      <a
  href="/bmw-m2-team-cup.png"
  target="_blank"
  rel="noreferrer"
  title="BMW M2 TEAM CUP"
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    flexShrink: 0,
    borderRadius: 20,
    padding: 2,
    background: "linear-gradient(90deg, #00A0FF, #4C4CFF, #FF1E1E)",
    boxShadow:
      "0 8px 24px rgba(0,0,0,0.4), " +
      "0 0 14px rgba(0,163,255,0.12), " +
      "0 0 14px rgba(123,97,255,0.10), " +
      "0 0 14px rgba(255,59,59,0.10)",
  }}
>
  <div
    style={{
      borderRadius: 18,
      padding: 6,
      background: "#07080c",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <img
  src="/bmw-m2-team-cup.png"
  alt="BMW M2 TEAM CUP"
  style={{
    height: "clamp(78px, 10vw, 110px)",
    maxWidth: "100%",
    width: "auto",
    borderRadius: 14,
    display: "block",
  }}
/>
  </div>
</a>
    </div>
  )
}

function SummaryStrip({
  winner,
  bestQuali,
  bestRaceLap,
  unionMeta,
  showMeta,
  showLobby,
  currentSprint,
  exporting = false,
}: {
  winner: string
  bestQuali: string
  bestRaceLap: string
  unionMeta: UnionMeta
  showMeta: boolean
  showLobby: boolean
  currentSprint: 1 | 2
  exporting?: boolean
}) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
          
          <HeaderBadge label="WINNER" value={winner} variant="silver" exporting={exporting} />

          <Separator exporting={exporting} />

          <HeaderBadge label="POLE (QUALIFICA)" value={bestQuali} variant="gold" exporting={exporting} />

          <Separator exporting={exporting} />

          <HeaderBadge label="BEST LAP (GARA)" value={bestRaceLap} variant="violet" exporting={exporting} />

          {showMeta && (
            <>
              <Separator exporting={exporting} />
              <HeaderBadge label="LEGA" value={unionMeta.lega} variant="gold" exporting={exporting} />
            </>
          )}

                    {showMeta && (
            <>
              <Separator exporting={exporting} />
              <HeaderBadge label="GARA" value={unionMeta.gara} variant="violet" exporting={exporting} />
            </>
          )}

          {showMeta && (
            <>
              <Separator exporting={exporting} />
              <HeaderBadge
                label="SPRINT"
                value={String(currentSprint)}
                variant={currentSprint === 1 ? "sprint1" : "sprint2"}
                exporting={exporting}
              />
            </>
          )}

          {showLobby && (
            <>
              <Separator exporting={exporting} />
              <HeaderBadge label="LOBBY" value={unionMeta.lobby} variant="gold" exporting={exporting} />
            </>
          )}

        </div>
      </div>
    </div>
  )
}

function ResultsTable({
  previewRows,
  bestRaceLap,
  unionMeta,
  prtMode,
  unionMode,
  currentSprint,
  exporting = false,
  penalties,
  forceHideMeta = false,
  tableTitle = "Classifica (output)",
  showTeamInsteadOfAuto = false,
  hideQualifyingColumn = false,
  resolveTeamName,
}: {
  previewRows: DisplayRow[]
  bestRaceLap: string
  unionMeta: UnionMeta
  prtMode: boolean
  unionMode: boolean
  currentSprint: 1 | 2
  exporting?: boolean
  penalties: PenaltyMap
  forceHideMeta?: boolean
  tableTitle?: string
  showTeamInsteadOfAuto?: boolean
  hideQualifyingColumn?: boolean
  resolveTeamName?: (row: DisplayRow) => string
}) {
  const showMeta = !forceHideMeta && (prtMode || unionMode)
  const showLobby = !forceHideMeta && unionMode
  const carOrTeamLabel = showTeamInsteadOfAuto ? "Team" : "Auto"

  const exportHasMultiPenalty = exporting && previewRows.some((row) => {
    const key = getPrtRowStableKey(row.sourcePosGara)
    return (penalties[key] || []).length > 1
  })

  const exportPenaltyTimeTextStyle: React.CSSProperties = {
    color: "#ff2d2d",
    fontWeight: 900,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: exporting ? 17 : 14,
    lineHeight: 1,
    whiteSpace: "nowrap",
    textAlign: "right",
  }

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.22)",
        overflowX: "auto",
        overflowY: "hidden",
      }}
    >
      <div
        style={{
          padding: exporting ? "11px 14px" : "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: exporting ? 15 : undefined }}>{tableTitle}</div>
        <div style={{ fontSize: exporting ? 13 : 12, opacity: 0.88, fontWeight: exporting ? 800 : undefined }}>
  {exporting ? `Partecipanti: ${previewRows.length}` : `${previewRows.length} partecipanti`}
</div>
      </div>

      <div style={{ minWidth: 0 }}>
        <table
  style={{
    width: "100%",
    minWidth: hideQualifyingColumn ? 1320 : 1500,
    borderCollapse: "collapse",
    tableLayout: "auto",
  }}
>
          <thead
            style={{
              position: exporting ? "static" : "sticky",
              top: 0,
              zIndex: 2,
              background: "rgba(10,12,18,0.92)",
              backdropFilter: exporting ? undefined : "blur(10px)",
            }}
          >
            <tr>
              <th style={{ padding: exporting ? "9px 8px" : "10px 6px", textAlign: "left", fontSize: exporting ? 15 : 11, opacity: 0.8, width: 46, minWidth: 46 }}>Pos</th>
              <th style={{ padding: exporting ? "11px 13px" : "12px 12px", textAlign: "left", fontSize: exporting ? 16 : 12, opacity: 0.8, minWidth: 210 }}>Pilota</th>
              <th
  style={{
    padding: exporting ? "11px 13px" : "12px 12px",
    textAlign: "left",
    fontSize: exporting ? 16 : 12,
    opacity: 0.8,
    minWidth: exporting ? 210 : 240,
  }}
>
  {carOrTeamLabel}
</th>

{!hideQualifyingColumn && (
  <th
    style={{
      padding: exporting ? "11px 13px" : "12px 12px",
      textAlign: "right",
      fontSize: exporting ? 16 : 12,
      opacity: 0.8,
      minWidth: 170,
    }}
  >
    Qualifica
  </th>
)}
              <th style={{ padding: exporting ? "11px 13px" : "12px 12px", textAlign: "right", fontSize: exporting ? 16 : 12, opacity: 0.8, minWidth: 150 }}>Tempi gara</th>
              <th
                style={{
                  padding: exporting ? "10px 11px" : "10px 8px",
                  textAlign: "center",
                  fontSize: exporting ? 15 : 11,
                  opacity: 0.8,
                  minWidth: exporting ? 430 : 270,
                  width: exporting ? 430 : 270,
                }}
              >
                Penalità
              </th>
              <th style={{ padding: exporting ? "11px 13px" : "12px 12px", textAlign: "right", fontSize: exporting ? 16 : 12, opacity: 0.8, minWidth: 240 }}>Miglior giro</th>
              <th
                style={{
                  padding: exporting ? "11px 13px" : "12px 12px",
                  textAlign: "center",
                  fontSize: exporting ? 16 : 12,
                  opacity: 0.8,
                  width: exporting ? 150 : 90,
                  minWidth: exporting ? 150 : 90,
                }}
              >
                Punti
              </th>

              {showMeta && (
                <th style={{ padding: exporting ? "10px 12px" : "12px 12px", textAlign: "center", fontSize: exporting ? 13 : 12, opacity: 0.8, minWidth: 80 }}>Gara</th>
              )}
              {showMeta && (
                <th style={{ padding: exporting ? "10px 12px" : "12px 12px", textAlign: "center", fontSize: exporting ? 13 : 12, opacity: 0.8, minWidth: 110 }}>Lega</th>
              )}
              {showLobby && (
                <th style={{ padding: exporting ? "10px 12px" : "12px 12px", textAlign: "center", fontSize: exporting ? 13 : 12, opacity: 0.8, minWidth: 95 }}>Lobby</th>
              )}
            </tr>
          </thead>

          <tbody>
            {previewRows.map((r, i) => {
              const tempo = tempoLikeGt7(r)
              const isPole = (r.pole || "").trim().toUpperCase() === "POLE"
              const bestLapTime = (bestRaceLap.split("  ").pop() || "").trim()
              const isBestLap = bestLapTime && (r.migliorGiroGara || "").trim() === bestLapTime
              const fallbackBg = i % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.10)"
              const key = getPrtRowStableKey(r.sourcePosGara)
              const penaltyEntries = penalties[key] || []
              const penaltyMain = getPenaltyMainDisplay(penaltyEntries)
              const isDsqRow = (r.tempoTotaleGara || "").trim().toUpperCase() === "DSQ"
              const showPenaltyDetail = !(exporting && unionMode)
              const rawTempo = tempoLikeGt7(r).trim().toUpperCase()

const isBox = rawTempo === "BOX"
const isDnf = rawTempo === "DNF" || rawTempo === "DNFV"
const isDnp = rawTempo === "DNP"
const isZeroPointsStatus = isBox || isDnf || isDnp || isDsqRow

const pointsValue = getPointsForPrtRow(r, bestRaceLap)

              const isP1 = r.posGara === 1
const isP2 = r.posGara === 2
const isP3 = r.posGara === 3
const isPodium = isP1 || isP2 || isP3

const resolvedTeamName = showTeamInsteadOfAuto
  ? (resolveTeamName?.(r) || "-")
  : r.auto

              const podiumBg = isP1
                ? "linear-gradient(180deg, rgba(255,215,0,1), rgba(255,200,0,0.95))"
                : isP2
                  ? "linear-gradient(180deg, rgba(220,220,220,0.96), rgba(185,185,185,0.96))"
                  : "linear-gradient(180deg, rgba(205,127,50,0.96), rgba(168,102,38,0.96))"

              const podiumBorder = isP1
                ? "1px solid rgba(255,215,0,0.55)"
                : isP2
                  ? "1px solid rgba(220,220,220,0.42)"
                : "1px solid rgba(205,127,50,0.45)"

              const podiumGlow = isP1
                ? "0 0 18px rgba(255,215,0,0.35)"
                : isP2
                  ? "0 0 14px rgba(220,220,220,0.22)"
                  : "0 0 14px rgba(205,127,50,0.22)"

              const normalPointsColor = exporting ? "#ffffff" : "#ecfff5"

              return (
                <tr
                  key={`${r.sourcePosGara}-${r.pilota}-${i}`}
                  style={
                    isDsqRow
                      ? {
                          background:
                            "linear-gradient(90deg, rgba(212,0,255,0.20) 0%, rgba(212,0,255,0.10) 30%, rgba(255,255,255,0.02) 78%)",
                          boxShadow: "inset 3px 0 0 rgba(212,0,255,0.85)",
                        }
                      : rowStyleForPos(r.posGara, fallbackBg)
                  }
                >
                  <TableCell
                    exporting={exporting}
                    align="center"
                    style={{
                      minWidth: 46,
                      width: 46,
                      padding: exporting ? "8px 6px" : "7px 4px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <PosBadge pos={r.posGara} />
                    </div>
                  </TableCell>

                  <TableCell
                    exporting={exporting}
                    style={{
                      fontSize: exporting ? 18 : undefined,
                      fontWeight: exporting ? (r.posGara === 1 ? 800 : 700) : undefined,
                      letterSpacing: exporting ? "0.04em" : undefined,
                      color: exporting ? (r.posGara === 1 ? "#fff6cc" : "#ffffff") : undefined,
                      textShadow: exporting ? (r.posGara === 1 ? "0 0 10px rgba(255,215,0,0.45)" : "none") : undefined,
                    }}
                  >
                    {r.pilota}
                  </TableCell>

                  <TableCell
  exporting={exporting}
  dim
  style={{
    fontSize: exporting ? 17 : undefined,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: exporting ? 260 : 220,
  }}
>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 9,
      minWidth: 0,
    }}
  >
    {/* BMW ///M stripes */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        flexShrink: 0,
        transform: "skewX(-16deg)",
        transformOrigin: "center",
      }}
    >
      <span
        style={{
          width: exporting ? 5 : 4,
          height: exporting ? 18 : 14,
          borderRadius: 2,
          background: "linear-gradient(180deg, #6fd3ff 0%, #3bb4e6 100%)",
          boxShadow: "0 0 6px rgba(91,192,255,0.4)",
        }}
      />
      <span
        style={{
          width: exporting ? 5 : 4,
          height: exporting ? 18 : 14,
          borderRadius: 2,
          background: "linear-gradient(180deg, #8b5dff 0%, #6a3dff 100%)",
          boxShadow: "0 0 6px rgba(124,77,255,0.4)",
        }}
      />
      <span
        style={{
          width: exporting ? 5 : 4,
          height: exporting ? 18 : 14,
          borderRadius: 2,
          background: "linear-gradient(180deg, #ff6666 0%, #ff2f2f 100%)",
          boxShadow: "0 0 6px rgba(255,59,59,0.4)",
        }}
      />
    </div>

    <span
      style={{
        fontSize: exporting ? 15 : 13,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: "rgba(255,255,255,0.9)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {resolvedTeamName || "-"}
    </span>
  </div>
</TableCell>

{!hideQualifyingColumn && (
  <TableCell
    exporting={exporting}
    align="right"
    mono
    dim={currentSprint === 1 ? (!r.tempoQualifica && !isPole) : false}
    style={{
      whiteSpace: "nowrap",
      fontSize: exporting ? 17 : undefined,
    }}
  >
    {currentSprint === 2 ? (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: exporting ? "6px 12px" : "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(96,165,250,0.24)",
      background:
        "linear-gradient(180deg, rgba(96,165,250,0.13), rgba(59,130,246,0.055))",
      boxShadow: exporting
        ? "0 0 9px rgba(96,165,250,0.07)"
        : "0 0 10px rgba(96,165,250,0.08)",
      color: "rgba(219,234,254,0.84)",
      fontWeight: 800,
      fontSize: exporting ? 12.5 : 11,
      letterSpacing: exporting ? 0.35 : 0.4,
      textTransform: "uppercase",
      whiteSpace: "nowrap",
      lineHeight: 1.1,
    }}
  >
    Griglia invertita
  </span>
) : isPole ? (
      <Pill
        left="POLE"
        right={r.tempoQualifica || undefined}
        variant="gold"
        exporting={exporting}
      />
    ) : (
      r.tempoQualifica || "-"
    )}
  </TableCell>
)}

                  <TableCell
                    exporting={exporting}
                    align="right"
                    mono
                    style={{
                      whiteSpace: "nowrap",
                      fontSize: exporting ? 17 : undefined,
                    }}
                  >
                    {renderTempoCell(tempo)}
                  </TableCell>
                                    <TableCell
                    exporting={exporting}
                    align="center"
                    mono
                    dim={penaltyEntries.length === 0 && !isDsqRow}
                    style={{
                      fontSize: exporting ? 16 : 12,
                      minWidth: exporting ? 430 : 270,
                      width: exporting ? 430 : 270,
                      padding: exporting ? "8px 8px" : "7px 6px",
                    }}
                  >
                    {(() => {
                      if (isDsqRow || penaltyMain.kind === "dsq") {
                        return <Pill left="DSQ" variant="dsq" />
                      }

                      if (penaltyEntries.length === 0) {
                        return "-"
                      }

                      if (!showPenaltyDetail) {
                        if (penaltyMain.kind === "ammonition") {
                          return (
                            <div
                              style={{
                                ...exportPenaltyTimeTextStyle,
                                color: "#f59e0b",
                              }}
                            >
                              00:00.000
                            </div>
                          )
                        }

                        if (penaltyMain.kind === "time") {
                          return (
                            <div style={exportPenaltyTimeTextStyle}>
                              {penaltyMain.text}
                            </div>
                          )
                        }

                        return "-"
                      }

                      if (penaltyEntries.length === 1) {
                        const entry = penaltyEntries[0]
                        const rule = getPenaltyRule(entry.code)

                        if (exportHasMultiPenalty) {
                          return (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: exporting ? 18 : 16,
                                minHeight: exporting ? 34 : 28,
                                width: "100%",
                              }}
                            >
                              <div
                                style={{
                                  whiteSpace: "nowrap",
                                  minWidth: exporting ? 108 : 92,
                                  textAlign: "right",
                                  flexShrink: 0,
                                }}
                              >
                                {(() => {
                                  if (rule.effect === "ammonition") {
                                    return (
                                      <div
                                        style={{
                                          ...exportPenaltyTimeTextStyle,
                                          color: "#f59e0b",
                                        }}
                                      >
                                        00:00.000
                                      </div>
                                    )
                                  }

                                  if (rule.effect === "dsq") {
                                    return <Pill left="DSQ" variant="dsq" />
                                  }

                                  if (rule.effect === "time") {
                                    return <div style={exportPenaltyTimeTextStyle}>{penaltyMain.text}</div>
                                  }

                                  return "-"
                                })()}
                              </div>

                              <div
                                style={{
                                  borderLeft: "1px solid rgba(255,255,255,0.18)",
                                  paddingLeft: exporting ? 14 : 12,
                                  minWidth: 0,
                                  width: "100%",
                                  display: "grid",
                                  gridTemplateColumns: exporting ? "repeat(2, minmax(0, 1fr))" : "1fr",
                                  gap: exporting ? "6px 12px" : 4,
                                  alignItems: "start",
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: exporting ? 14 : 12,
                                    lineHeight: exporting ? 1.18 : 1.15,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    letterSpacing: exporting ? 0.1 : undefined,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: exporting ? 8 : 6,
                                    minWidth: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      padding: exporting ? "4px 9px" : "2px 6px",
                                      borderRadius: 6,
                                      fontWeight: 900,
                                      fontSize: exporting ? 15 : 12,
                                      letterSpacing: 0.2,
                                      color: "white",
                                      background:
                                        rule.effect === "ammonition"
                                          ? "#f59e0b"
                                          : rule.effect === "dsq"
                                            ? "#ff4dff"
                                            : "#ff2d2d",
                                      boxShadow:
                                        rule.effect === "ammonition"
                                          ? "0 0 10px rgba(245,158,11,0.35)"
                                          : rule.effect === "dsq"
                                            ? "0 0 10px rgba(255,77,255,0.35)"
                                            : "0 0 10px rgba(255,45,45,0.35)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {entry.code}
                                  </span>

                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 2,
                                      minWidth: 0,
                                    }}
                                  >
                                    <span>Lap</span>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        minWidth: exporting ? 16 : 12,
                                        textAlign: "right",
                                      }}
                                    >
                                      {entry.lap === "Lap -" ? "-" : entry.lap.replace("Lap ", "").replace("Lap", "")}
                                    </span>
                                  </span>

                                  <span
                                    style={{
                                      display: "inline-block",
                                      minWidth: exporting ? 40 : 34,
                                      textAlign: "right",
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {entry.lap === "Lap -" ? "--:--" : `${entry.minute}:${entry.second}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: exporting ? 18 : 14,
                              minHeight: exporting ? 34 : 28,
                              width: "100%",
                            }}
                          >
                            <div
                              style={{
                                whiteSpace: "nowrap",
                                minWidth: exporting ? 108 : 92,
                                textAlign: "right",
                                flexShrink: 0,
                              }}
                            >
                              {(() => {
                                if (rule.effect === "ammonition") {
                                  return (
                                    <div
                                      style={{
                                        ...exportPenaltyTimeTextStyle,
                                        color: "#f59e0b",
                                      }}
                                    >
                                      00:00.000
                                    </div>
                                  )
                                }

                                if (rule.effect === "dsq") {
                                  return <Pill left="DSQ" variant="dsq" />
                                }

                                if (rule.effect === "time") {
                                  return <div style={exportPenaltyTimeTextStyle}>{penaltyMain.text}</div>
                                }

                                return "-"
                              })()}
                            </div>

                            <div
                              style={{
                                borderLeft: "1px solid rgba(255,255,255,0.18)",
                                paddingLeft: exporting ? 14 : 12,
                                display: "grid",
                                gap: exporting ? 5 : 4,
                                justifyItems: "start",
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: exporting ? 15 : 12,
                                  lineHeight: exporting ? 1.05 : 1.15,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  letterSpacing: exporting ? 0.05 : undefined,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: exporting ? 10 : 6,
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: exporting ? "5px 11px" : "2px 6px",
                                    borderRadius: 7,
                                    fontWeight: 900,
                                    fontSize: exporting ? 16 : 12,
                                    letterSpacing: 0.15,
                                    color: "white",
                                    background:
                                      rule.effect === "ammonition"
                                        ? "#f59e0b"
                                        : rule.effect === "dsq"
                                          ? "#ff4dff"
                                          : "#ff2d2d",
                                    boxShadow:
                                      rule.effect === "ammonition"
                                        ? "0 0 10px rgba(245,158,11,0.35)"
                                        : rule.effect === "dsq"
                                          ? "0 0 10px rgba(255,77,255,0.35)"
                                          : "0 0 10px rgba(255,45,45,0.35)",
                                    flexShrink: 0,
                                  }}
                                >
                                  {entry.code}
                                </span>

                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  <span>Lap</span>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      minWidth: exporting ? 22 : 12,
                                      textAlign: "right",
                                    }}
                                  >
                                    {entry.lap === "Lap -" ? "-" : entry.lap.replace("Lap ", "").replace("Lap", "")}
                                  </span>
                                </span>

                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    minWidth: exporting ? 54 : 34,
                                    justifyContent: "flex-end",
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                    fontSize: exporting ? 15 : 12,
                                    lineHeight: 1.1,
                                  }}
                                >
                                  {entry.lap === "Lap -" ? "--:--" : `${entry.minute}:${entry.second}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }

                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: exporting ? 18 : 16,
                            minHeight: exporting ? 34 : 28,
                            width: "100%",
                          }}
                        >
                          <div
                            style={{
                              whiteSpace: "nowrap",
                              minWidth: exporting ? 108 : 92,
                              textAlign: "right",
                              flexShrink: 0,
                            }}
                          >
                            {(() => {
                              if (penaltyMain.kind === "ammonition") {
                                return (
                                  <div
                                    style={{
                                      ...exportPenaltyTimeTextStyle,
                                      color: "#f59e0b",
                                    }}
                                  >
                                    00:00.000
                                  </div>
                                )
                              }

                              if (hasDsqPenalty(penaltyEntries)) {
                                return <Pill left="DSQ" variant="dsq" />
                              }

                              if (penaltyMain.kind === "time") {
                                return <div style={exportPenaltyTimeTextStyle}>{penaltyMain.text}</div>
                              }

                              return "-"
                            })()}
                          </div>

                          <div
                            style={{
                              borderLeft: "1px solid rgba(255,255,255,0.18)",
                              paddingLeft: exporting ? 14 : 12,
                              minWidth: 0,
                              width: "100%",
                              display: "grid",
                              gridTemplateColumns: exporting ? "repeat(2, minmax(0, 1fr))" : "1fr",
                              gap: exporting ? "6px 12px" : 4,
                              alignItems: "start",
                            }}
                          >
                            {penaltyEntries.slice(0, 4).map((entry) => {
                              const rule = getPenaltyRule(entry.code)

                              return (
                                <div
                                  key={entry.id}
                                  style={{
                                    fontSize: exporting ? 13 : 12,
                                    lineHeight: exporting ? 1.18 : 1.15,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    letterSpacing: exporting ? 0.1 : undefined,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: exporting ? 6 : 6,
                                    minWidth: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      padding: exporting ? "2px 6px" : "2px 6px",
                                      borderRadius: 6,
                                      fontWeight: 900,
                                      fontSize: exporting ? 13 : 12,
                                      letterSpacing: 0.2,
                                      color: "white",
                                      background:
                                        rule.effect === "ammonition"
                                          ? "#f59e0b"
                                          : rule.effect === "dsq"
                                            ? "#ff4dff"
                                            : "#ff2d2d",
                                      boxShadow:
                                        rule.effect === "ammonition"
                                          ? "0 0 10px rgba(245,158,11,0.35)"
                                          : rule.effect === "dsq"
                                            ? "0 0 10px rgba(255,77,255,0.35)"
                                            : "0 0 10px rgba(255,45,45,0.35)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {entry.code}
                                  </span>

                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 2,
                                      minWidth: 0,
                                    }}
                                  >
                                    <span>Lap</span>
                                    <span
                                      style={{
                                        display: "inline-block",
                                        minWidth: exporting ? 16 : 12,
                                        textAlign: "right",
                                      }}
                                    >
                                      {entry.lap === "Lap -" ? "-" : entry.lap.replace("Lap ", "").replace("Lap", "")}
                                    </span>
                                  </span>

                                  <span
                                    style={{
                                      display: "inline-block",
                                      minWidth: exporting ? 40 : 34,
                                      textAlign: "right",
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {entry.lap === "Lap -" ? "--:--" : `${entry.minute}:${entry.second}`}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}
                  </TableCell>

                  <TableCell
                    exporting={exporting}
                    align="right"
                    mono
                    dim={!r.migliorGiroGara}
                    style={{
                      whiteSpace: "nowrap",
                      fontSize: exporting ? 17 : undefined,
                    }}
                  >
                    {isBestLap && r.migliorGiroGara ? (
                      <Pill left="BEST LAP" right={r.migliorGiroGara} variant="violet" exporting={exporting} />
                    ) : (
                      r.migliorGiroGara || "-"
                    )}
                  </TableCell>

                  <TableCell
                    exporting={exporting}
                    align="center"
                    mono
                    style={{
                      whiteSpace: "nowrap",
                      fontSize: exporting ? 16 : 13,
                      fontWeight: 900,
                    }}
                  >
                    {isPodium ? (
                      <span
                        style={{
                          position: "relative",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: exporting ? 30 : 26,
                          height: exporting ? 20 : 18,
                          padding: exporting ? "0 8px" : "0 7px",
                          borderRadius: 999,
                          background: podiumBg,
                          border: podiumBorder,
                          boxShadow: podiumGlow,
                          color: "rgba(0,0,0,0.95)",
                          fontWeight: 900,
                          fontSize: exporting ? 12 : 11,
                          lineHeight: 1,
                          transform: "translateY(-1px)",
                        }}
                        title={
                          isZeroPointsStatus
                            ? "Punti gara: 0"
                            : isPole && isBestLap
                              ? "Bonus: POLE + BEST LAP"
                              : isPole
                                ? "Bonus: POLE"
                                : isBestLap
                                  ? "Bonus: BEST LAP"
                                  : "Punti gara"
                        }
                      >
                        <span>{pointsValue}</span>

                        {(isPole || isBestLap) && (
                          <span
                            style={{
                              position: "absolute",
                              top: exporting ? -6 : -5,
                              right:
                                isPole && isBestLap
                                  ? (exporting ? -14 : -12)
                                  : (exporting ? -9 : -7),
                              display: "flex",
                              gap: 1,
                              fontSize: exporting ? 10 : 9,
                              lineHeight: 1,
                            }}
                          >
                            {isPole && (
                              <span
                                style={{
                                  color: "#ffd700",
                                  textShadow: "0 0 6px rgba(255,215,0,0.45)",
                                }}
                              >
                                ★
                              </span>
                            )}

                            {isBestLap && (
                              <span
                                style={{
                                  color: "#b67cff",
                                  textShadow: "0 0 6px rgba(160,90,255,0.45)",
                                }}
                              >
                                ★
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span
                        title={
                          isZeroPointsStatus
                            ? "Punti gara: 0"
                            : isPole && isBestLap
                              ? "Bonus: POLE + BEST LAP"
                              : isPole
                                ? "Bonus: POLE"
                                : isBestLap
                                  ? "Bonus: BEST LAP"
                                  : "Punti gara"
                        }
                        style={{
                          position: "relative",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: exporting ? 34 : 30,
                          height: exporting ? 20 : 18,
                          padding: exporting ? "0 8px" : "0 7px",
                          borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.22)",
                          background: "transparent",
                          boxShadow: "none",
                          color: normalPointsColor,
                          fontWeight: 900,
                          fontSize: exporting ? 16 : 14,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          letterSpacing: 0.1,
                          textShadow: exporting
                            ? "0 0 8px rgba(255,255,255,0.10)"
                            : "0 0 8px rgba(64,224,208,0.12)",
                        }}
                      >
                        <span>{pointsValue}</span>

                        {(isPole || isBestLap) && (
                          <span
                            style={{
                              position: "absolute",
                              top: exporting ? -6 : -5,
                              right:
                                isPole && isBestLap
                                  ? (exporting ? -14 : -12)
                                  : (exporting ? -9 : -7),
                              display: "flex",
                              gap: 1,
                              fontSize: exporting ? 10 : 9,
                              lineHeight: 1,
                            }}
                          >
                            {isPole && (
                              <span
                                style={{
                                  color: "#ffd700",
                                  textShadow: "0 0 6px rgba(255,215,0,0.45)",
                                }}
                              >
                                ★
                              </span>
                            )}

                            {isBestLap && (
                              <span
                                style={{
                                  color: "#b67cff",
                                  textShadow: "0 0 6px rgba(160,90,255,0.45)",
                                }}
                              >
                                ★
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    )}
                  </TableCell>

                  {showMeta && (
  <TableCell exporting={exporting} align="center" mono dim={!unionMeta.gara}>
    {String(unionMeta.gara).trim() === "-" ? (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: exporting ? 34 : 28,
          height: exporting ? 28 : 24,
          padding: exporting ? "0 10px" : "0 8px",
          borderRadius: 999,
          background: "rgba(255,165,0,0.16)",
          border: "1px solid rgba(255,165,0,0.32)",
          boxShadow: "0 0 10px rgba(255,165,0,0.12)",
          color: "#fff3e0",
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        -
      </span>
    ) : (
      unionMeta.gara || "-"
    )}
  </TableCell>
)}

                  {showMeta && (
                    <TableCell exporting={exporting} align="center" mono dim={!unionMeta.lega}>
                      {unionMeta.lega || "-"}
                    </TableCell>
                  )}

                  {showLobby && (
                    <TableCell exporting={exporting} align="center" mono dim={!unionMeta.lobby}>
                      {unionMeta.lobby || "-"}
                    </TableCell>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function renderMiniRoundDetail(
  value:
    | string
    | {
        text: string
        pole?: boolean
        bestLap?: boolean
      },
  exporting = false
) {
  const detail =
    typeof value === "string"
      ? { text: value, pole: false, bestLap: false }
      : {
          text: String(value?.text || "").trim(),
          pole: !!value?.pole,
          bestLap: !!value?.bestLap,
        }

  const upper = String(detail.text || "").trim().toUpperCase()

  const miniPillStyle = (
    background: string,
    border: string,
    color: string
  ): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: exporting ? 40 : 34,
    height: exporting ? 18 : 16,
    padding: exporting ? "0 7px" : "0 6px",
    borderRadius: 999,
    background,
    border,
    color,
    fontSize: exporting ? 9 : 8,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  })

  if (upper === "DNF-I") {
    return (
      <span
        style={miniPillStyle(
          "rgba(64,224,208,0.92)",
          "1px solid rgba(64,224,208,0.55)",
          "rgba(0,0,0,0.92)"
        )}
      >
        DNF-I
      </span>
    )
  }

  if (upper === "DNF-V") {
    return (
      <span
        style={miniPillStyle(
          "rgba(64,224,208,0.92)",
          "1px solid rgba(64,224,208,0.55)",
          "rgba(0,0,0,0.92)"
        )}
      >
        DNF-V
      </span>
    )
  }

  if (upper === "DNP") {
    return (
      <span
        style={miniPillStyle(
          "rgba(64,224,208,0.92)",
          "1px solid rgba(64,224,208,0.55)",
          "rgba(0,0,0,0.92)"
        )}
      >
        DNP
      </span>
    )
  }

  if (upper === "-") {
    return <>{detail.text || "-"}</>
  }

  const isP1 = upper === "1°"
  const isP2 = upper === "2°"
  const isP3 = upper === "3°"

  if (isP1 || isP2 || isP3) {
    const background = isP1
      ? "linear-gradient(180deg, rgba(255,215,0,1), rgba(255,200,0,0.95))"
      : isP2
        ? "linear-gradient(180deg, rgba(220,220,220,0.96), rgba(185,185,185,0.96))"
        : "linear-gradient(180deg, rgba(205,127,50,0.96), rgba(168,102,38,0.96))"

    const border = isP1
      ? "1px solid rgba(255,215,0,0.55)"
      : isP2
        ? "1px solid rgba(220,220,220,0.42)"
        : "1px solid rgba(205,127,50,0.45)"

    const glow = isP1
      ? "0 0 12px rgba(255,215,0,0.25)"
      : isP2
        ? "0 0 10px rgba(220,220,220,0.18)"
        : "0 0 10px rgba(205,127,50,0.18)"

    return (
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: exporting ? 36 : 32,
          minWidth: exporting ? 36 : 32,
          height: exporting ? 20 : 18,
          padding: 0,
          borderRadius: 999,
          background,
          border,
          boxShadow: glow,
          color: "rgba(0,0,0,0.95)",
          fontSize: exporting ? 10 : 9,
          fontWeight: 900,
          lineHeight: 1,
          whiteSpace: "nowrap",
          textAlign: "center",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            textAlign: "center",
          }}
        >
          {detail.text}
        </span>

        {(detail.pole || detail.bestLap) && (
          <span
            style={{
              position: "absolute",
              top: exporting ? -5 : -4,
              right:
                detail.pole && detail.bestLap
                  ? (exporting ? -12 : -10)
                  : (exporting ? -8 : -7),
              display: "flex",
              gap: 1,
              fontSize: exporting ? 9 : 8,
              lineHeight: 1,
            }}
          >
            {detail.pole && (
              <span
                style={{
                  color: "#ffd700",
                  textShadow: "0 0 6px rgba(255,215,0,0.45)",
                }}
              >
                ★
              </span>
            )}

            {detail.bestLap && (
              <span
                style={{
                  color: "#b67cff",
                  textShadow: "0 0 6px rgba(160,90,255,0.45)",
                }}
              >
                ★
              </span>
            )}
          </span>
        )}
      </span>
    )
  }

  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: exporting ? 36 : 32,
        minWidth: exporting ? 36 : 32,
        fontSize: exporting ? 11 : 10,
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
        textAlign: "center",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontVariantNumeric: "tabular-nums",
        transform: "translateY(2px)",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          textAlign: "center",
        }}
      >
        {detail.text || "-"}
      </span>

      {(detail.pole || detail.bestLap) && (
        <span
          style={{
            position: "absolute",
            top: exporting ? -5 : -4,
            right:
              detail.pole && detail.bestLap
                ? (exporting ? -4 : -3)
                : (exporting ? -1 : 0),
            display: "flex",
            gap: 1,
            fontSize: exporting ? 9 : 8,
            lineHeight: 1,
          }}
        >
          {detail.pole && (
            <span
              style={{
                color: "#ffd700",
                textShadow: "0 0 6px rgba(255,215,0,0.45)",
              }}
            >
              ★
            </span>
          )}

          {detail.bestLap && (
            <span
              style={{
                color: "#b67cff",
                textShadow: "0 0 6px rgba(160,90,255,0.45)",
              }}
            >
              ★
            </span>
          )}
        </span>
      )}
    </span>
  )
}

function TeamChampionshipTable({
  teams,
  exporting = false,
  currentRound,
  title = "Classifica Generale TEAM BMW CUP",
  getTeamRoundDetail,
}: {
  teams: TeamEntry[]
  exporting?: boolean
  currentRound: 1 | 2 | 3 | 4
  title?: string
  getTeamRoundDetail: (
  teamName: string,
  round: number,
  sprint: "sprint1" | "sprint2"
) => {
  pro: {
    text: string
    pole?: boolean
    bestLap?: boolean
  }
  proAma: {
    text: string
    pole?: boolean
    bestLap?: boolean
  }
  ama: {
    text: string
    pole?: boolean
    bestLap?: boolean
  }
}
}) {
  return (
    <div
      style={{
        borderRadius: exporting ? 20 : 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(0,0,0,0.22)",
        overflow: "hidden",
        boxShadow: exporting ? "0 12px 40px rgba(0,0,0,0.28)" : undefined,
      }}
    >
      <div
        style={{
          padding: exporting ? "10px 14px" : "12px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: exporting ? 10 : 8,
            flexWrap: "wrap",
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontWeight: 900,
              fontSize: exporting ? 18 : 16,
              letterSpacing: 0.4,
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </div>
        </div>

        <div
          style={{
            padding: exporting ? "7px 12px" : "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            fontSize: exporting ? 12 : 11,
            fontWeight: 900,
            letterSpacing: 0.5,
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          Team classificati: {teams.length}
        </div>
      </div>

      <div style={{ overflowX: "auto", height: "100%" }}>
        <table
          style={{
            width: "100%",
            minWidth: exporting ? 1760 : 1340,
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead
            style={{
              background: "rgba(10,12,18,0.92)",
            }}
          >
            <tr>
              <th
                style={{
                  padding: exporting ? "8px 8px" : "10px 8px",
                  textAlign: "center",
                  fontSize: exporting ? 13 : 12,
                  opacity: 0.82,
                  width: exporting ? 52 : 42,
                }}
              >
                Pos
              </th>

              <th
                style={{
                  padding: exporting ? "8px 10px" : "10px 10px",
                  textAlign: "left",
                  fontSize: exporting ? 13 : 12,
                  opacity: 0.82,
                  width: exporting ? 250 : 220,
                }}
              >
                Team
              </th>

              <th
                style={{
                  padding: exporting ? "8px 4px" : "10px 4px",
                  textAlign: "center",
                  fontSize: exporting ? 11 : 10,
                  opacity: 0.82,
                  width: exporting ? 44 : 38,
                }}
              >
                &nbsp;
              </th>

              {[1, 2, 3, 4].map((round) => (
  <th
    key={`head-round-${round}`}
    style={{
      padding: exporting ? "8px 4px" : "10px 4px",
      textAlign: "center",
      fontSize: exporting ? 11 : 11,
      opacity: 0.9,
      width: exporting ? 170 : 145,
    }}
  >
    <div
      style={{
        display: "grid",
        gap: exporting ? 4 : 3,
        justifyItems: "center",
      }}
    >
      <div
        style={{
          fontWeight: 900,
          fontSize: exporting ? 12 : 11,
          lineHeight: 1,
          letterSpacing: 0.25,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {`ROUND ${round}`}
      </div>

      <div
  style={{
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: exporting ? 6 : 5,
    width: "100%",
    fontSize: exporting ? 10 : 9,
    fontWeight: 900,
    letterSpacing: 0.2,
    lineHeight: 1,
  }}
>
  <span
    style={{
      color: "#00cfff",
      textShadow: "0 0 8px rgba(0,207,255,0.25)",
    }}
  >
    PRO
  </span>

  <span style={{ opacity: 0.35 }}>•</span>

  <span
    style={{
      color: "#9b6bff",
      textShadow: "0 0 8px rgba(155,107,255,0.25)",
    }}
  >
    PAMA
  </span>

  <span style={{ opacity: 0.35 }}>•</span>

  <span
    style={{
      color: "#ff4d4d",
      textShadow: "0 0 8px rgba(255,77,77,0.25)",
    }}
  >
    AMA
  </span>
</div>
    </div>
  </th>
))}

              {(["r1", "r2", "r3", "r4"] as RoundKey[]).map((roundKey) => (
                <th
                  key={roundKey}
                  style={{
                    padding: exporting ? "8px 4px" : "10px 4px",
                    textAlign: "center",
                    fontSize: exporting ? 12 : 12,
                    opacity: 0.82,
                    width: exporting ? 74 : 64,
                  }}
                >
                  {roundKey.toUpperCase()}
                </th>
              ))}

              <th
                style={{
                  padding: exporting ? "8px 6px" : "10px 6px",
                  textAlign: "center",
                  fontSize: exporting ? 13 : 12,
                  opacity: 0.92,
                  width: exporting ? 96 : 86,
                }}
              >
                TOT
              </th>
            </tr>
          </thead>

          <tbody>
            {teams.map((team, idx) => {
              const pos = idx + 1
              const isP1 = pos === 1
              const isP2 = pos === 2
              const isP3 = pos === 3

              const rowBg = isP1
                ? "linear-gradient(90deg, rgba(255,215,0,0.12) 0%, rgba(255,215,0,0.05) 28%, rgba(255,255,255,0.02) 70%)"
                : isP2
                  ? "linear-gradient(90deg, rgba(220,220,220,0.10) 0%, rgba(220,220,220,0.04) 28%, rgba(255,255,255,0.02) 70%)"
                  : isP3
                    ? "linear-gradient(90deg, rgba(205,127,50,0.12) 0%, rgba(205,127,50,0.05) 28%, rgba(255,255,255,0.02) 70%)"
                    : idx % 2 === 0
                      ? "rgba(255,255,255,0.02)"
                      : "rgba(0,0,0,0.10)"

              const totalBadgeBg = isP1
                ? "linear-gradient(180deg, rgba(255,215,0,1), rgba(255,200,0,0.95))"
                : isP2
                  ? "linear-gradient(180deg, rgba(220,220,220,0.96), rgba(185,185,185,0.96))"
                  : isP3
                    ? "linear-gradient(180deg, rgba(205,127,50,0.96), rgba(168,102,38,0.96))"
                    : "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))"

              const totalBadgeColor =
                isP1 || isP2 || isP3 ? "rgba(0,0,0,0.95)" : "#ffffff"

              return (
                <tr key={`${team.team}-${idx}`} style={{ background: rowBg }}>
                  <td
                    style={{
                      padding: exporting ? "8px 6px" : "8px 6px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <PosBadge pos={pos} />
                    </div>
                  </td>

                  <td
                    style={{
                      padding: exporting ? "8px 10px" : "8px 10px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: exporting ? 8 : 9,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          flexShrink: 0,
                          transform: "skewX(-16deg)",
                          transformOrigin: "center",
                        }}
                      >
                        <span
                          style={{
                            width: exporting ? 5 : 4,
                            height: exporting ? 17 : 14,
                            borderRadius: 2,
                            background: "linear-gradient(180deg, #6fd3ff 0%, #3bb4e6 100%)",
                            boxShadow: "0 0 6px rgba(91,192,255,0.4)",
                          }}
                        />
                        <span
                          style={{
                            width: exporting ? 5 : 4,
                            height: exporting ? 17 : 14,
                            borderRadius: 2,
                            background: "linear-gradient(180deg, #8b5dff 0%, #6a3dff 100%)",
                            boxShadow: "0 0 6px rgba(124,77,255,0.4)",
                          }}
                        />
                        <span
                          style={{
                            width: exporting ? 5 : 4,
                            height: exporting ? 17 : 14,
                            borderRadius: 2,
                            background: "linear-gradient(180deg, #ff6666 0%, #ff2f2f 100%)",
                            boxShadow: "0 0 6px rgba(255,59,59,0.4)",
                          }}
                        />
                      </div>

                      <span
                        style={{
                          fontSize: exporting ? 15 : 13,
                          fontWeight: 900,
                          letterSpacing: exporting ? "0.02em" : "0.02em",
                          color: exporting
                            ? isP1
                              ? "#fff6cc"
                              : "#ffffff"
                            : "rgba(255,255,255,0.92)",
                          textShadow:
                            exporting && isP1
                              ? "0 0 8px rgba(255,215,0,0.30)"
                              : "none",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1,
                        }}
                      >
                        {team.team}
                      </span>
                    </div>
                  </td>

                  <td
                    style={{
                      padding: exporting ? "4px 2px" : "4px 2px",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      textAlign: "center",
                      width: exporting ? 44 : 38,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: exporting ? 6 : 5,
                        justifyItems: "center",
                      }}
                    >
                      {["S1", "S2"].map((label) => (
                        <span
                          key={`${team.team}-${label}`}
                          style={{
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: exporting ? 28 : 24,
  height: exporting ? 18 : 16,
  padding: exporting ? "0 6px" : "0 5px",
  borderRadius: 999,

  // 🔥 COLORI COMPLETAMENTE DIVERSI
  border:
    label === "S1"
      ? "1px solid rgba(0,207,255,0.5)" // AZZURRO
      : "1px solid rgba(168,85,247,0.5)", // VIOLA

  background:
    label === "S1"
      ? "rgba(0,207,255,0.22)" // AZZURRO
      : "rgba(168,85,247,0.22)", // VIOLA

  boxShadow:
    label === "S1"
      ? "0 0 10px rgba(0,207,255,0.35)"
      : "0 0 10px rgba(168,85,247,0.35)",

  color: "#ffffff",
  fontSize: exporting ? 10 : 9,
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: 0.2,
}}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>

                  {[1, 2, 3, 4].map((round) => {
                    const s1 = getTeamRoundDetail(team.team, round, "sprint1")
                    const s2 = getTeamRoundDetail(team.team, round, "sprint2")

                    return (
                      <td
                        key={`${team.team}-detail-${round}`}
                        style={{
  padding: exporting ? "4px 4px" : "5px 4px",
  textAlign: "center",
  borderBottom: "1px solid rgba(255,255,255,0.08)",

  // 🔥 QUESTA È LA MODIFICA
  borderLeft: "1px solid rgba(255,255,255,0.08)",

  width: exporting ? 170 : 145,
}}
                      >
                        <div
                          style={{
                            display: "grid",
                            gap: exporting ? 6 : 5,
                          }}
                        >
                          {[s1, s2].map((detail, rowIndex) => (
                            <div
                              key={`${team.team}-detail-${round}-${rowIndex}`}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                                gap: exporting ? 4 : 3,
                                width: "100%",
                                maxWidth: exporting ? 132 : 118,
                                margin: "0 auto",
                                fontSize: exporting ? 12 : 11,
                                fontWeight: 900,
                                lineHeight: 1,
                                fontFamily:
                                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                color: "rgba(255,255,255,0.96)",
                              }}
                            >
                              <div style={{ textAlign: "center" }}>
  {renderMiniRoundDetail(detail.pro, exporting)}
</div>
<div style={{ textAlign: "center" }}>
  {renderMiniRoundDetail(detail.proAma, exporting)}
</div>
<div style={{ textAlign: "center" }}>
  {renderMiniRoundDetail(detail.ama, exporting)}
</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    )
                  })}

                  {(["r1", "r2", "r3", "r4"] as RoundKey[]).map((r) => (
                    <td
                      key={`${team.team}-${r}`}
                      style={{
                        padding: exporting ? "6px 4px" : "7px 4px",
                        textAlign: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        borderLeft: "1px solid rgba(255,255,255,0.08)",
                        fontSize: exporting ? 14 : 13,
                        fontWeight: 900,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        color:
                          (team.rounds[r] || 0) > 0
                            ? "#ffffff"
                            : "rgba(255,255,255,0.42)",
                      }}
                    >
                      {team.rounds[r] || 0}
                    </td>
                  ))}

                  <td
                    style={{
                      padding: exporting ? "6px 4px" : "7px 4px",
                      textAlign: "center",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      borderLeft: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: exporting ? 54 : 58,
                        height: exporting ? 26 : 28,
                        padding: exporting ? "0 10px" : "0 10px",
                        borderRadius: 999,
                        background: totalBadgeBg,
                        border:
                          isP1
                            ? "1px solid rgba(255,215,0,0.55)"
                            : isP2
                              ? "1px solid rgba(220,220,220,0.42)"
                              : isP3
                                ? "1px solid rgba(205,127,50,0.45)"
                                : "1px solid rgba(255,255,255,0.14)",
                        boxShadow:
                          isP1
                            ? "0 0 14px rgba(255,215,0,0.28)"
                            : isP2
                              ? "0 0 11px rgba(220,220,220,0.18)"
                              : isP3
                                ? "0 0 11px rgba(205,127,50,0.18)"
                                : "0 0 8px rgba(255,255,255,0.05)",
                        color: totalBadgeColor,
                        fontWeight: 900,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: exporting ? 16 : 15,
                        letterSpacing: 0.2,
                        lineHeight: 1,
                      }}
                    >
                      {team.total}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Page() {
  const [showSplash, setShowSplash] = useState(true)
const [authorized, setAuthorized] = useState(false)
const [authChecked, setAuthChecked] = useState(false)
const [inputPassword, setInputPassword] = useState("")
const [loginError, setLoginError] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [csv, setCsv] = useState("")
  const [rows, setRows] = useState<ExtractRow[]>([])
  const [unionMeta, setUnionMeta] = useState<UnionMeta>({ gara: "", lobby: "", lega: "" })
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingGeneralTeamsPng, setExportingGeneralTeamsPng] = useState(false)
  const [exportingHtml, setExportingHtml] = useState(false)
  const [exportingGeneralTeamsHtml, setExportingGeneralTeamsHtml] = useState(false)
  const [error, setError] = useState("")
  const [showTable, setShowTable] = useState(true)
  const [showReq, setShowReq] = useState(false)
  const [prtMode, setPrtMode] = useState(true)
  const [unionMode, setUnionMode] = useState(false)
  const [bmwCupMode, setBmwCupMode] = useState(true)
  const [penalties, setPenalties] = useState<PenaltyMap>({})
  const [exportMetaInPng, setExportMetaInPng] = useState(false)
  const [lapOverrides, setLapOverrides] = useState<Record<string, string>>({})
  const [dnfOverrides, setDnfOverrides] = useState<DnfOverrideMap>({})
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportTarget, setExportTarget] = useState<"png" | "html" | "html-teams" | null>(null)
  const [showSprintInfo, setShowSprintInfo] = useState(false)
  const [showMatchDetails, setShowMatchDetails] = useState(false)
  const [showGeneralRoundDetails, setShowGeneralRoundDetails] = useState(false)
  const [showDgTable, setShowDgTable] = useState(false)
  const [pendingSprint2Upload, setPendingSprint2Upload] = useState(false)
  const [showSprint2DoneInfo, setShowSprint2DoneInfo] = useState(false)
  const [showSprint2UploadConfirm, setShowSprint2UploadConfirm] = useState(false)
  const [showSprintResetConfirm, setShowSprintResetConfirm] = useState(false)
  const [sprint2Ready, setSprint2Ready] = useState(false)
  const [showReopenLeagueModal, setShowReopenLeagueModal] = useState(false)
  const [isReopenedSavedSprint, setIsReopenedSavedSprint] = useState(false)
const [reopenedSprintKey, setReopenedSprintKey] = useState<"sprint1" | "sprint2" | null>(null)
const [selectedLeagueToReopen, setSelectedLeagueToReopen] = useState<BmwLeagueName | null>(null)
const [showResetLeagueModal, setShowResetLeagueModal] = useState(false)
const [selectedLeagueToReset, setSelectedLeagueToReset] = useState<BmwLeagueName | null>(null)
const [showResetLeagueSuccessModal, setShowResetLeagueSuccessModal] = useState(false)
const [lastResetLeagueName, setLastResetLeagueName] = useState<BmwLeagueName | null>(null)
const [showResetAllLeaguesModal, setShowResetAllLeaguesModal] = useState(false)
const [showResetAllLeaguesSuccessModal, setShowResetAllLeaguesSuccessModal] = useState(false)
const [showSaveLeagueSuccessModal, setShowSaveLeagueSuccessModal] = useState(false)
const [lastSavedLeagueName, setLastSavedLeagueName] = useState<BmwLeagueName | null>(null)
const [lastSaveLeagueMode, setLastSaveLeagueMode] = useState<"save" | "overwrite">("save")
const [showSprintSaveSuccessModal, setShowSprintSaveSuccessModal] = useState(false)
const [lastSavedSprintNumber, setLastSavedSprintNumber] = useState<1 | 2 | null>(null)
const [lastSprintSaveMode, setLastSprintSaveMode] = useState<"save" | "overwrite">("save")
const [showConfirmSaveLeagueModal, setShowConfirmSaveLeagueModal] = useState(false)
const [pendingSaveLeagueMode, setPendingSaveLeagueMode] = useState<"save" | "overwrite">("save")
  const [manualGaraOverride, setManualGaraOverride] = useState("")
  const [manualLegaOverride, setManualLegaOverride] = useState("")

  const [manualPilotOverrides, setManualPilotOverrides] = useState<Record<number, string>>({})
  const [manualAutoOverrides, setManualAutoOverrides] = useState<Record<number, string>>({})
  const [manualDistaccoOverrides, setManualDistaccoOverrides] = useState<Record<number, string>>({})
  const [pilotModalRows, setPilotModalRows] = useState<DisplayRow[]>([])

  const [showPilotModal, setShowPilotModal] = useState(false)
const [manualPilotDraft, setManualPilotDraft] = useState<Record<number, string>>({})
const [showDistaccoModal, setShowDistaccoModal] = useState(false)
const [manualDistaccoDraft, setManualDistaccoDraft] = useState<Record<number, string>>({})
const [showConfirmFinalizeRoundModal, setShowConfirmFinalizeRoundModal] = useState(false)
const [finalizeRoundMode, setFinalizeRoundMode] = useState<"save" | "overwrite">("save")
const [showMissingPilotWarning, setShowMissingPilotWarning] = useState(false)

    const [exportTexts, setExportTexts] = useState({
    mainTitle: "BMW M2 TEAM CUP",
    sideLabel: "Official Timing System",
    subtitle: "Powered by Albixximo",
  })

  const [exportTextsDraft, setExportTextsDraft] = useState(exportTexts)
  const [teams, setTeams] = useState<TeamEntry[]>([])

  const [currentRound, setCurrentRound] = useState<1 | 2 | 3 | 4>(1)
const [currentSprint, setCurrentSprint] = useState<1 | 2>(1)
const [showRoundSelector, setShowRoundSelector] = useState(false)
const [pendingRoundChange, setPendingRoundChange] = useState<1 | 2 | 3 | 4 | null>(null)
const [showRoundChangeConfirmModal, setShowRoundChangeConfirmModal] = useState(false)

const [roundSnapshots, setRoundSnapshots] = useState<
  Partial<Record<RoundKey, BmwRoundSnapshot>>
>({})

const [savedSprintPreviews, setSavedSprintPreviews] = useState<{
  sprint1: BmwSprintSnapshot | null
  sprint2: BmwSprintSnapshot | null
}>({
  sprint1: null,
  sprint2: null,
})

  const BMW_EVENT_STORAGE_KEY = "bmw_m2_team_event_v2"

  const BMW_BACKUP_VERSION = 1

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const exportRef = useRef<HTMLDivElement | null>(null)
  const teamGeneralExportRef = useRef<HTMLDivElement | null>(null)
  const topPageRef = useRef<HTMLDivElement | null>(null)
  const teamPreviewRef = useRef<HTMLDivElement | null>(null)
  const backupImportRef = useRef<HTMLInputElement | null>(null)
  

  function initializeTeams(data: {
    team: string
    lobby1: string
    lobby2: string
    lobby3: string
  }[]) {
    const initialized: TeamEntry[] = data.map((t) => ({
      team: t.team,
      lobby1: t.lobby1,
      lobby2: t.lobby2,
      lobby3: t.lobby3,
      rounds: {
        r1: 0,
        r2: 0,
        r3: 0,
        r4: 0,
      },
      total: 0,
    }))

    setTeams(initialized)
  }

  useEffect(() => {
  const saved = localStorage.getItem(BMW_EVENT_STORAGE_KEY)
  if (!saved) return

  try {
    const parsed = JSON.parse(saved)

    if (Array.isArray(parsed)) {
      setTeams(parsed)
      return
    }

    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.teams)) {
        setTeams(parsed.teams)
      }

      if ([1, 2, 3, 4].includes(parsed.currentRound)) {
        setCurrentRound(parsed.currentRound)
      }

      if (parsed.roundSnapshots && typeof parsed.roundSnapshots === "object") {
        setRoundSnapshots(parsed.roundSnapshots)
      }
    }
  } catch {}
}, [])

useEffect(() => {
  if (teams.length === 0) return

  const payload: BmwEventStorage = {
    teams,
    currentRound,
    roundSnapshots,
  }

  localStorage.setItem(BMW_EVENT_STORAGE_KEY, JSON.stringify(payload))
}, [teams, currentRound, roundSnapshots])




  useEffect(() => {
  const saved = localStorage.getItem(BMW_EVENT_STORAGE_KEY)

  if (!saved && teams.length === 0) {
    initializeTeams([
      { team: "GVG Motorsport", lobby1: "Grollo78", lobby2: "Giannivir64", lobby3: "Verdi76" },
      { team: "Tic Tac Team", lobby1: "N_spec2", lobby2: "Maverickblaze", lobby3: "Theblackcorsair1" },
      { team: "BWT M2 Team Cup", lobby1: "Gioski", lobby2: "Soldatinoxx", lobby3: "Wwp76" },
      { team: "AGK Motorsport", lobby1: "Albixximo", lobby2: "GaboCasper85", lobby3: "Kedok956" },
      { team: "THE PRT BROS", lobby1: "Olly_oli", lobby2: "Brodo-mago", lobby3: "Snorky-70" },
      { team: "SPR Motorsport team", lobby1: "Sbrizio72", lobby2: "Ptr.bso", lobby3: "Roncoa73" },
      { team: "DTC Team M2", lobby1: "Prt_Danielex84", lobby2: "Tcarlisi", lobby3: "Conradveron59" },
      { team: "KIBOY TEAM", lobby1: "Sulimanov", lobby2: "Snoop", lobby3: "Frederik2905" },
      { team: "KZM Racing", lobby1: "MaxLukex", lobby2: "The-Knipex", lobby3: "Zio_zero7" },
      { team: "STS CORSE", lobby1: "Senpai_Zen", lobby2: "xSamueLx", lobby3: "Tommyx_tommyx" },
      { team: "ATS - Asphalt Titans Squad", lobby1: "Bumbumpenny", lobby2: "Karl_55_", lobby3: "Muffo007" },
      { team: "MFF Racing", lobby1: "M_ApeX_", lobby2: "Fedemastro", lobby3: "Perseo_1975" },
      { team: "RMS Team", lobby1: "Rekkia-Speed", lobby2: "Martina-2008", lobby3: "Stephan1187" },
      { team: "SNS SCUDERIAcorse", lobby1: "Sissibabu", lobby2: "Neapolis100", lobby3: "Simoppr" },
    ])
  }
}, [teams.length])

    function normalizeTeamPilotName(value: string) {
  let v = String(value || "")
    .trim()
    .toLowerCase()

  v = v.replace(/^prt[\s._-]*/i, "")
  v = v.replace(/[_\-.]/g, "")
  v = v.replace(/\s+/g, "")

  return v
}

 const BMW_ROUND_SUBSTITUTES: Partial<Record<RoundKey, Record<string, string>>> = {
  r2: {
    Margotone: "Gioski",
    CAPITAN_FINDUS: "Albixximo",
    "PRT-Jaiss84": "Sbrizio72",
    Perdincibaccoli: "MaxLukex",
    Divino991: "Simoppr",
  },

  r3: {
    "PRT-Jaiss84": "Sbrizio72",
  },

  r4: {
    "PRT-Jaiss84": "Sbrizio72",
  },
} 

function findTeamByPilot(pilotName: string): TeamLookupResult {
  const normalized = normalizeTeamPilotName(pilotName)
  if (!normalized) return null

  const roundKey = getRoundKey(currentRound)
  const substitutes = BMW_ROUND_SUBSTITUTES[roundKey] || {}

  const officialPilotName =
    Object.entries(substitutes).find(
      ([substituteName]) =>
        normalizeTeamPilotName(substituteName) === normalized
    )?.[1] || pilotName

  const normalizedOfficial = normalizeTeamPilotName(officialPilotName)

  for (const teamEntry of teams) {
    if (normalizeTeamPilotName(teamEntry.lobby1) === normalizedOfficial) {
      return {
        team: teamEntry.team,
        lobby: "lobby1",
        lega: "PRO",
      }
    }

    if (normalizeTeamPilotName(teamEntry.lobby2) === normalizedOfficial) {
      return {
        team: teamEntry.team,
        lobby: "lobby2",
        lega: "PRO-AMA",
      }
    }

    if (normalizeTeamPilotName(teamEntry.lobby3) === normalizedOfficial) {
      return {
        team: teamEntry.team,
        lobby: "lobby3",
        lega: "AMA",
      }
    }
  }

  return null
}

  function hasMissingPilotRows(rowsToCheck: DisplayRow[]) {
  return rowsToCheck.some((row) => {
    const pilot = String(row.pilota || "").trim()

    return (
      pilot === "" ||
      pilot === "-" ||
      pilot.toLowerCase() === "null" ||
      pilot.toLowerCase() === "undefined"
    )
  })
}

  function resolveTeamForDisplayRow(row: DisplayRow): string {
  const finalPilotName = String(row.pilota || "").trim()
  const originalPreviewRow = previewRows.find(
    (candidate) => candidate.sourcePosGara === row.sourcePosGara
  )
  const originalPilotName = String(originalPreviewRow?.pilota || "").trim()

  // 1) Prima: nome finale corretto manualmente
  const directFinalMatch = findTeamByPilot(finalPilotName)
  if (directFinalMatch?.team) {
    return directFinalMatch.team
  }

  // 2) Poi: nome originale OCR della stessa riga
  const originalMatch = findTeamByPilot(originalPilotName)
  if (originalMatch?.team) {
    return originalMatch.team
  }

  // 3) Ultimo fallback
  return "-"
}

  function getBmwLeagueFromRows(rowsToCheck: DisplayRow[]): string {
  const counts: Record<string, number> = {}

  for (const row of rowsToCheck) {
    const lega = String(findTeamByPilot(row.pilota)?.lega || "").trim().toUpperCase()
    if (!lega) continue

    if (lega === "PRO" || lega === "PRO-AMA" || lega === "AMA") {
      counts[lega] = (counts[lega] || 0) + 1
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]

    const priority: Record<string, number> = {
      PRO: 3,
      "PRO-AMA": 2,
      AMA: 1,
    }

    return (priority[b[0]] || 0) - (priority[a[0]] || 0)
  })

  return sorted[0]?.[0] || ""
}

  /* =========================
   BMW HELPERS (NEW FOUNDATION)
   ========================= */

function getBmwDriverIdFromName(name: string) {
  return normalizeTeamPilotName(name || "")
}

function getBmwLeagueNameFromDetected(rawLeague: string): BmwLeagueName | null {
  const lega = String(rawLeague || "").trim().toUpperCase()

  if (lega === "PRO") return "PRO"
  if (lega === "PRO-AMA") return "PRO-AMA"
  if (lega === "AMA") return "AMA"

  return null
}

function getBmwDriverStatusFromRow(row: DisplayRow): BmwDriverStatus {
  const rawTempo = tempoLikeGt7(row).trim().toUpperCase()

  if (!rawTempo) return "finish"
  if (rawTempo === "DNF" || rawTempo === "DNF-I") return "dnf-i"
  if (rawTempo === "DNFV" || rawTempo === "DNF-V") return "dnf-v"
  if (rawTempo === "DNP") return "dnp"
  if (rawTempo === "BOX") return "box"
  if (rawTempo === "DSQ") return "dnf-v"

  return "finish"
}

function isBmwZeroPointStatusNew(status: BmwDriverStatus) {
  return status === "dnf-v" || status === "dnp" || status === "box"
}

function isBmwCompletionBonusEligibleStatus(status: BmwDriverStatus) {
  return status === "finish" || status === "dnf-i"
}

function getBmwPointsForPositionNew(position: number) {
  const pointsMap: Record<number, number> = {
    1: 25,
    2: 22,
    3: 19,
    4: 16,
    5: 14,
    6: 12,
    7: 10,
    8: 8,
    9: 6,
    10: 5,
    11: 4,
    12: 3,
    13: 2,
    14: 1,
  }

  return pointsMap[position] ?? 0
}

function buildBmwSprintDrivers(rows: DisplayRow[], bestRaceLap: string): BmwSprintDriver[] {
  const bestLapTime = (bestRaceLap.split("  ").pop() || "").trim()

  const finishRows = rows.filter((row) => getBmwDriverStatusFromRow(row) === "finish")
  const dnfIRows = rows.filter((row) => getBmwDriverStatusFromRow(row) === "dnf-i")
  const dnfVRows = rows.filter((row) => getBmwDriverStatusFromRow(row) === "dnf-v")
  const dnpRows = rows.filter((row) => getBmwDriverStatusFromRow(row) === "dnp")
  const boxRows = rows.filter((row) => getBmwDriverStatusFromRow(row) === "box")

  const orderedRows = [...finishRows, ...dnfIRows, ...dnfVRows, ...dnpRows, ...boxRows]

  return orderedRows.map((row, index) => {
    const found = findTeamByPilot(row.pilota)
    const status = getBmwDriverStatusFromRow(row)

    const effectivePosition = index + 1
    const isPole = (row.pole || "").trim().toUpperCase() === "POLE"
    const isBestLap = !!bestLapTime && (row.migliorGiroGara || "").trim() === bestLapTime

    const basePoints = isBmwZeroPointStatusNew(status)
  ? 0
  : getBmwPointsForPositionNew(effectivePosition)

    const poleBonus = isPole ? 1 : 0
    const bestLapBonus = isBestLap ? 1 : 0

    return {
      driverId: getBmwDriverIdFromName(row.pilota),
      driverName: row.pilota,
      team: found?.team || "-",
      lega: found?.lega || "-",
      lobby: found?.lobby || "-",
      position: effectivePosition,
      status,
      basePoints,
      poleBonus,
      bestLapBonus,
      totalPoints: basePoints + poleBonus + bestLapBonus,
    }
  })
}

function buildBmwLeagueDriversFromSprints(
  sprint1: BmwSprintSnapshot | null,
  sprint2: BmwSprintSnapshot | null
): BmwRoundDriver[] {
  if (!sprint1 || !sprint2) return []

  const sprint1Map = new Map<string, BmwSprintDriver>()
  const sprint2Map = new Map<string, BmwSprintDriver>()

  for (const driver of sprint1.drivers) {
    sprint1Map.set(driver.driverId, driver)
  }

  for (const driver of sprint2.drivers) {
    sprint2Map.set(driver.driverId, driver)
  }

  const allDriverIds = new Set([
    ...Array.from(sprint1Map.keys()),
    ...Array.from(sprint2Map.keys()),
  ])

  const rows: BmwRoundDriver[] = []

  for (const driverId of allDriverIds) {
    const d1 = sprint1Map.get(driverId) || null
    const d2 = sprint2Map.get(driverId) || null

    const driverName = d1?.driverName || d2?.driverName || ""
    const team = d1?.team || d2?.team || "-"
    const lega = d1?.lega || d2?.lega || "-"
    const lobby = d1?.lobby || d2?.lobby || "-"

    const sprint1Points = d1?.totalPoints || 0
    const sprint2Points = d2?.totalPoints || 0

    const sprint1Status = d1?.status || null
    const sprint2Status = d2?.status || null

    const bonusCompletion =
      sprint1Status &&
      sprint2Status &&
      isBmwCompletionBonusEligibleStatus(sprint1Status) &&
      isBmwCompletionBonusEligibleStatus(sprint2Status)
        ? 5
        : 0

    rows.push({
      driverId,
      driverName,
      team,
      lega,
      lobby,
      sprint1Points,
      sprint2Points,
      sprint1Status,
      sprint2Status,
      bonusCompletion,
      totalPoints: sprint1Points + sprint2Points + bonusCompletion,
    })
  }

  rows.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.driverName.localeCompare(b.driverName)
  })

  return rows
}
  
  function getRoundKey(round: 1 | 2 | 3 | 4): RoundKey {
  return `r${round}` as RoundKey
}

function getCurrentBmwLeagueName(): BmwLeagueName | null {
  const lega = String(effectiveLegaResolved || "").trim().toUpperCase()

  if (lega === "PRO") return "PRO"
  if (lega === "PRO-AMA") return "PRO-AMA"
  if (lega === "AMA") return "AMA"

  return null
}

function recalculateTeamTotals(teamRows: TeamEntry[]): TeamEntry[] {
  return teamRows.map((team) => {
    const total =
      (team.rounds.r1 || 0) +
      (team.rounds.r2 || 0) +
      (team.rounds.r3 || 0) +
      (team.rounds.r4 || 0)

    return {
      ...team,
      total,
    }
  })
}

function getBmwLeagueSnapshotStatus(
  sprint1: BmwSprintSnapshot | null,
  sprint2: BmwSprintSnapshot | null
): BmwLeagueSnapshotStatus {
  if (!sprint1 && !sprint2) return "empty"
  if (sprint1 && sprint2) return "complete"
  return "saved"
}

function buildBmwRoundTeamResultsFromLeagues(
  leagues: Partial<Record<BmwLeagueName, BmwLeagueSnapshot>>,
  teamRows: TeamEntry[]
): BmwTeamRoundResult[] {
  const map = new Map<string, BmwTeamRoundResult>()

  for (const team of teamRows) {
    map.set(team.team, {
      team: team.team,
      pro: 0,
      proAma: 0,
      ama: 0,
      total: 0,
    })
  }

  const allLeagueSnapshots = Object.values(leagues).filter(Boolean) as BmwLeagueSnapshot[]

  for (const leagueSnapshot of allLeagueSnapshots) {
    for (const driver of leagueSnapshot.drivers || []) {
      if (!driver.team || driver.team === "-") continue

      const current = map.get(driver.team) || {
        team: driver.team,
        pro: 0,
        proAma: 0,
        ama: 0,
        total: 0,
      }

      if (leagueSnapshot.league === "PRO") current.pro += driver.totalPoints
      if (leagueSnapshot.league === "PRO-AMA") current.proAma += driver.totalPoints
      if (leagueSnapshot.league === "AMA") current.ama += driver.totalPoints

      current.total = current.pro + current.proAma + current.ama
      map.set(driver.team, current)
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.pro !== a.pro) return b.pro - a.pro
    if (b.proAma !== a.proAma) return b.proAma - a.proAma
    if (b.ama !== a.ama) return b.ama - a.ama
    return a.team.localeCompare(b.team)
  })
}

function buildBmwGeneralTeamResultsFromRoundSnapshots(
  snapshots: Partial<Record<RoundKey, BmwRoundSnapshot>>,
  teamRows: TeamEntry[]
): BmwTeamRoundResult[] {
  const map = new Map<string, BmwTeamRoundResult>()

  for (const team of teamRows) {
    map.set(team.team, {
      team: team.team,
      pro: 0,
      proAma: 0,
      ama: 0,
      total: 0,
    })
  }

  for (const roundSnapshot of Object.values(snapshots).filter(Boolean) as BmwRoundSnapshot[]) {
    for (const row of roundSnapshot.roundTeamResults || []) {
      const current = map.get(row.team) || {
        team: row.team,
        pro: 0,
        proAma: 0,
        ama: 0,
        total: 0,
      }

      current.pro += row.pro
      current.proAma += row.proAma
      current.ama += row.ama
      current.total = current.pro + current.proAma + current.ama

      map.set(row.team, current)
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.pro !== a.pro) return b.pro - a.pro
    if (b.proAma !== a.proAma) return b.proAma - a.proAma
    if (b.ama !== a.ama) return b.ama - a.ama
    return a.team.localeCompare(b.team)
  })
}

function buildTeamsFromRoundSnapshots(
  baseTeams: TeamEntry[],
  snapshots: Partial<Record<RoundKey, BmwRoundSnapshot>>
): TeamEntry[] {
  const nextTeams = baseTeams.map((team) => ({
    ...team,
    rounds: {
      r1: 0,
      r2: 0,
      r3: 0,
      r4: 0,
    },
    total: 0,
  }))

  for (const team of nextTeams) {
    for (const roundKey of ["r1", "r2", "r3", "r4"] as RoundKey[]) {
      const roundSnapshot = snapshots[roundKey]
      const found = roundSnapshot?.roundTeamResults?.find((row) => row.team === team.team)

      team.rounds[roundKey] = found?.total ?? 0
    }
  }

  return recalculateTeamTotals(nextTeams)
}

function formatStandingPosition(pos: number | null | undefined) {
  if (!pos || pos <= 0) return "-"
  return `${pos}°`
}

function getTeamRoundDetail(
  teamName: string,
  round: number,
  sprint: "sprint1" | "sprint2"
): {
  pro: {
    text: string
    pole?: boolean
    bestLap?: boolean
  }
  proAma: {
    text: string
    pole?: boolean
    bestLap?: boolean
  }
  ama: {
    text: string
    pole?: boolean
    bestLap?: boolean
  }
} {
  const roundKey = `r${round}` as RoundKey
  const roundSnapshot = roundSnapshots[roundKey]

  const emptyValue = {
    text: "-",
    pole: false,
    bestLap: false,
  }

  if (!roundSnapshot?.leagues) {
    return {
      pro: emptyValue,
      proAma: emptyValue,
      ama: emptyValue,
    }
  }

  const getLeaguePos = (
    leagueName: BmwLeagueName
  ): {
    text: string
    pole?: boolean
    bestLap?: boolean
  } => {
    const leagueSnapshot = roundSnapshot.leagues?.[leagueName]
    if (!leagueSnapshot) return emptyValue

    const sprintSnapshot =
      sprint === "sprint1" ? leagueSnapshot.sprint1 : leagueSnapshot.sprint2

    if (!sprintSnapshot?.drivers?.length) return emptyValue

    const orderedDrivers = [...sprintSnapshot.drivers]

    const foundIndex = orderedDrivers.findIndex(
      (driver) => driver.team === teamName
    )

    if (foundIndex === -1) return emptyValue

    const foundDriver = orderedDrivers[foundIndex]
    const status = String(foundDriver?.status || "").trim().toLowerCase()

    if (status === "dnf-i") {
      return { text: "DNF-I" }
    }

    if (status === "dnf-v") {
      return { text: "DNF-V" }
    }

    if (status === "dnp") {
      return { text: "DNP" }
    }

    return {
      text: formatStandingPosition(foundIndex + 1),
      pole: (foundDriver?.poleBonus || 0) > 0,
      bestLap: (foundDriver?.bestLapBonus || 0) > 0,
    }
  }

  return {
    pro: getLeaguePos("PRO"),
    proAma: getLeaguePos("PRO-AMA"),
    ama: getLeaguePos("AMA"),
  }
}

function isLeagueSnapshotComplete(leagueSnapshot: BmwLeagueSnapshot | null | undefined) {
  if (!leagueSnapshot) return false
  return !!(leagueSnapshot.sprint1 && leagueSnapshot.sprint2)
}

function isRoundSnapshotReady(roundSnapshot: BmwRoundSnapshot | null | undefined) {
  if (!roundSnapshot) return false

  const pro = roundSnapshot.leagues?.["PRO"]
  const proAma = roundSnapshot.leagues?.["PRO-AMA"]
  const ama = roundSnapshot.leagues?.["AMA"]

  return (
    isLeagueSnapshotComplete(pro) &&
    isLeagueSnapshotComplete(proAma) &&
    isLeagueSnapshotComplete(ama)
  )
}

function buildLiveBmwTeamStandings(
  pilotRows: BmwPilotRacePoints[],
  teamRows: TeamEntry[]
): BmwTeamStandingRow[] {
  const map = new Map<string, BmwTeamStandingRow>()

  for (const team of teamRows) {
    map.set(team.team, {
      team: team.team,
      pro: 0,
      proAma: 0,
      ama: 0,
      bonus: 0,
      total: 0,
    })
  }

  for (const row of pilotRows) {
    if (!row.team || row.team === "-") continue

    const current = map.get(row.team) || {
      team: row.team,
      pro: 0,
      proAma: 0,
      ama: 0,
      bonus: 0,
      total: 0,
    }

    if (row.lega === "PRO") current.pro += row.totalPoints
    if (row.lega === "PRO-AMA") current.proAma += row.totalPoints
    if (row.lega === "AMA") current.ama += row.totalPoints

    map.set(row.team, current)
  }

  const standings = Array.from(map.values()).map((row) => {
    const bonus = getBmwTeamCompletionBonus(row.team, pilotRows)
    const total = row.pro + row.proAma + row.ama + bonus

    return {
      ...row,
      bonus,
      total,
    }
  })

  standings.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    if (b.bonus !== a.bonus) return b.bonus - a.bonus
    if (b.pro !== a.pro) return b.pro - a.pro
    if (b.proAma !== a.proAma) return b.proAma - a.proAma
    if (b.ama !== a.ama) return b.ama - a.ama
    return a.team.localeCompare(b.team)
  })

  return standings
}
  function getBmwTeamCompletionBonus(
  teamName: string,
  pilotRows: BmwPilotRacePoints[]
): number {
  const teamPilots = pilotRows.filter((row) => row.team === teamName)

  if (teamPilots.length < 3) return 0

  const eligibleCount = teamPilots.filter((row) =>
    isBmwEligibleForCompletionBonus(row.status)
  ).length

  return eligibleCount === 3 ? 5 : 0
}

  function getBmwPointsForPosition(position: number) {
    return BMW_POINTS_BY_POSITION[position] ?? 0
  }

  function getBmwRaceStatusFromRow(row: DisplayRow): BmwRaceStatus {
  const rawTempo = tempoLikeGt7(row).trim().toUpperCase()

  if (!rawTempo) return "finish"
  if (rawTempo === "DNFV" || rawTempo === "DNF-V") return "dnf-v"
  if (rawTempo === "DNF" || rawTempo === "DNF-I") return "dnf-i"
  if (rawTempo === "DNP") return "dnp"
  if (rawTempo === "BOX") return "dnf-v"
  if (rawTempo === "DSQ") return "dnf-v"

  return "finish"
}

  function isBmwZeroPointStatus(status: BmwRaceStatus) {
    return status === "dnf-v" || status === "dnp"
  }

  function isBmwEligibleForCompletionBonus(status: BmwRaceStatus) {
    return status === "finish" || status === "dnf-i"
  }

    function buildBmwPilotRacePoints(rows: DisplayRow[]): BmwPilotRacePoints[] {
    const bestLapTime = (bestRaceLap.split("  ").pop() || "").trim()

    const finishRows = rows.filter((row) => getBmwRaceStatusFromRow(row) === "finish")
const dnfIRows = rows.filter((row) => getBmwRaceStatusFromRow(row) === "dnf-i")
const dnfVRows = rows.filter((row) => getBmwRaceStatusFromRow(row) === "dnf-v")
const dnpRows = rows.filter((row) => getBmwRaceStatusFromRow(row) === "dnp")

const orderedRows = [...finishRows, ...dnfIRows, ...dnfVRows, ...dnpRows]

    return orderedRows.map((row, index) => {
      const found = findTeamByPilot(row.pilota)
      const status = getBmwRaceStatusFromRow(row)

      const effectivePosition = index + 1
      const isPole = (row.pole || "").trim().toUpperCase() === "POLE"
      const isBestLap = !!bestLapTime && (row.migliorGiroGara || "").trim() === bestLapTime

      const basePoints = isBmwZeroPointStatus(status)
        ? 0
        : getBmwPointsForPosition(effectivePosition)

      const poleBonus = isPole ? 1 : 0
      const bestLapBonus = isBestLap ? 1 : 0

      return {
        pilota: row.pilota,
        team: found?.team || "-",
        lega: found?.lega || "-",
        lobby: found?.lobby || "-",
        posGara: effectivePosition,
        status,
        basePoints,
        poleBonus,
        bestLapBonus,
        totalPoints: basePoints + poleBonus + bestLapBonus,
      }
    })
  }

  

  const canRun = useMemo(() => files.length >= 2, [files])
  const effectiveGara = useMemo(() => {
  const detected = String(unionMeta.gara || "").trim()
  return String(manualGaraOverride || detected || "").trim()
}, [manualGaraOverride, unionMeta.gara])


const normalizedGaraForOutput = useMemo(() => {
  const raw = String(effectiveGara || "").trim()

  if (!raw) return "-"
  if (raw === "-") return "-"
  if (raw === "18") return "-"

  return raw
}, [effectiveGara])

  const penaltyCodeOptions = useMemo(
    () => [
      { value: "DSQ", label: "DSQ (Squalifica)" },
      ...Array.from({ length: 39 }, (_, i) => {
        const n = i + 1
        const code = `P${String(n).padStart(2, "0")}`
        return {
          value: code,
          label: getPenaltyOptionText(code),
        }
      }),
    ],
    []
  )

  const lapOptions = useMemo(
    () => [
      "Lap -",
      ...Array.from({ length: 60 }, (_, i) => `Lap ${String(i + 1).padStart(2, "0")}`),
    ],
    []
  )

  const minuteOptions = useMemo(
    () => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")),
    []
  )

  const secondOptions = useMemo(
    () => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")),
    []
  )

  useEffect(() => {
  const savedAuth = sessionStorage.getItem(BMW_AUTH_STORAGE_KEY)

  if (savedAuth === "true") {
    setAuthorized(true)
  }

  setAuthChecked(true)

  const timer = setTimeout(() => {
    setShowSplash(false)
  }, 10000)

  return () => clearTimeout(timer)
}, [])
  
  useEffect(() => {
  const style = document.createElement("style")
  style.innerHTML = `
    @keyframes unionLoadSlide {
      0% { left: -35%; }
      50% { left: 100%; }
      100% { left: -35%; }
    }

    @keyframes unionLoadShine {
      0% { left: -20%; }
      50% { left: 100%; }
      100% { left: -20%; }
    }

    @keyframes bmwSlashPulse {
      0% {
        opacity: 0.22;
        transform: translateY(0px) scale(0.96);
      }
      50% {
        opacity: 1;
        transform: translateY(-1px) scale(1);
      }
      100% {
        opacity: 0.22;
        transform: translateY(0px) scale(0.96);
      }
    }

    @keyframes bmwSplashFade {
      0% { opacity: 0; transform: scale(1.02); }
      10% { opacity: 1; transform: scale(1); }
      90% { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(0.995); }
    }

    @keyframes bmwGlowCycle {
  0% {
    box-shadow:
      0 0 40px rgba(111, 211, 255, 0.35),
      0 0 80px rgba(111, 211, 255, 0.18);
  }
  33% {
    box-shadow:
      0 0 40px rgba(106, 61, 255, 0.35),
      0 0 80px rgba(106, 61, 255, 0.18);
  }
  66% {
    box-shadow:
      0 0 40px rgba(255, 59, 59, 0.35),
      0 0 80px rgba(255, 59, 59, 0.18);
  }
  100% {
    box-shadow:
      0 0 40px rgba(111, 211, 255, 0.35),
      0 0 80px rgba(111, 211, 255, 0.18);
  }
}

@keyframes bmwTextGlow {
  0% {
    text-shadow:
      0 0 6px rgba(111, 211, 255, 0.6),
      0 0 12px rgba(111, 211, 255, 0.3);
    opacity: 0.85;
  }
  33% {
    text-shadow:
      0 0 6px rgba(106, 61, 255, 0.6),
      0 0 12px rgba(106, 61, 255, 0.3);
    opacity: 1;
  }
  66% {
    text-shadow:
      0 0 6px rgba(255, 59, 59, 0.6),
      0 0 12px rgba(255, 59, 59, 0.3);
    opacity: 0.9;
  }
  100% {
    text-shadow:
      0 0 6px rgba(111, 211, 255, 0.6),
      0 0 12px rgba(111, 211, 255, 0.3);
    opacity: 0.85;
  }
}
  `
  document.head.appendChild(style)

  return () => {
    document.head.removeChild(style)
  }
}, [])

  const previewRows = useMemo<DisplayRow[]>(() => {
  const csvRows = parseCsvRows(csv)

  if (csvRows.length === 0) {
    return rows.map((r: any) => ({
      ...r,
      sourcePosGara: getSavedSourcePos(r),
    }))
  }

  const byPilot = new Map<string, ExtractRow>()
  const byPos = new Map<number, ExtractRow>()

  for (const r of csvRows) {
    byPilot.set(normalizePilot(r.pilota), r)
    byPos.set(r.posGara, r)
  }

  if (rows.length === 0) {
    return csvRows.map((r) => ({
      ...r,
      sourcePosGara: r.posGara,
    }))
  }

  return rows.map((r: any) => {
    const preservedSourcePos = getSavedSourcePos(r)

    const fromPilot = byPilot.get(normalizePilot(r.pilota))
    const fromPos = byPos.get(r.posGara)
    const merged = fromPilot || fromPos

    if (!merged) {
      return {
        ...r,
        sourcePosGara: preservedSourcePos,
      }
    }

    return {
      ...r,
      sourcePosGara: preservedSourcePos,
      posGara: merged.posGara || r.posGara,
      pilota: merged.pilota || r.pilota,
      auto: merged.auto || r.auto,
      tempoTotaleGara: merged.tempoTotaleGara || r.tempoTotaleGara,
      distaccoDalPrimo: merged.distaccoDalPrimo || r.distaccoDalPrimo,
      migliorGiroGara: merged.migliorGiroGara || r.migliorGiroGara,
      tempoQualifica: merged.tempoQualifica || r.tempoQualifica,
      pole: merged.pole || r.pole,
    }
  })
}, [rows, csv])

  const displayRows = useMemo<DisplayRow[]>(() => {
  const mappedRows = previewRows.map((r) => ({
    ...r,
    pilota: (manualPilotOverrides[r.sourcePosGara] ?? r.pilota ?? "").trim(),
    auto: (manualAutoOverrides[r.sourcePosGara] ?? r.auto ?? "").trim(),
    distaccoDalPrimo: (manualDistaccoOverrides[r.sourcePosGara] ?? r.distaccoDalPrimo ?? "").trim(),
  }))

  const detectedLegaFromMappedRows = getBmwLeagueFromRows(mappedRows)
  const currentLegaForCompletion =
    String(manualLegaOverride || "").trim().toUpperCase() ||
    String(detectedLegaFromMappedRows || "").trim().toUpperCase() ||
    String(unionMeta.lega || "").trim().toUpperCase()

  return ensureLeagueDriversFromTeams(
  mappedRows,
  teams,
  currentLegaForCompletion,
  BMW_ROUND_SUBSTITUTES[getRoundKey(currentRound)] || {}
)
}, [
  previewRows,
  manualPilotOverrides,
  manualAutoOverrides,
  manualDistaccoOverrides,
  manualLegaOverride,
  unionMeta.lega,
  teams,
])

const detectedBmwLega = useMemo(() => {
  return getBmwLeagueFromRows(displayRows)
}, [displayRows])

const effectiveLegaResolved = useMemo(() => {
  const manual = String(manualLegaOverride || "").trim().toUpperCase()
  if (manual) return manual

  // In BMW CUP la lega deve seguire prima il matching pilota -> team
  if (bmwCupMode) {
    const detectedFromTeams = String(detectedBmwLega || "").trim().toUpperCase()
    if (detectedFromTeams) return detectedFromTeams
  }

  const detectedMeta = String(unionMeta.lega || "").trim().toUpperCase()
  if (detectedMeta) return detectedMeta

  return ""
}, [manualLegaOverride, bmwCupMode, detectedBmwLega, unionMeta.lega])

const effectiveLega = effectiveLegaResolved

const hasManualPilotOverrides = useMemo(() => {
  return Object.keys(manualPilotOverrides).length > 0
}, [manualPilotOverrides])

  const hasManualDistaccoOverrides = useMemo(() => {
    return Object.keys(manualDistaccoOverrides).length > 0
  }, [manualDistaccoOverrides])

  const shouldSyncDgTableWithManualEdits = useMemo(() => {
    return hasManualPilotOverrides || hasManualDistaccoOverrides
  }, [hasManualPilotOverrides, hasManualDistaccoOverrides])

  const bestQuali = useMemo(() => {
    const poleRow = displayRows.find((r) => (r.pole || "").trim().toUpperCase() === "POLE")
    if (poleRow) {
      return `${poleRow.pilota || "?"}  ${poleRow.tempoQualifica || "-"}`
    }

    let bestMs: number | null = null
    let bestTime = ""
    let bestPilot = ""

    for (const r of displayRows) {
      const t = (r.tempoQualifica || "").trim()
      const ms = parseMmSsMmm(t)
      if (ms == null) continue
      if (bestMs == null || ms < bestMs) {
        bestMs = ms
        bestTime = t
        bestPilot = r.pilota || ""
      }
    }

    return bestTime ? `${bestPilot || "?"}  ${bestTime}` : ""
  }, [displayRows])

  const bestRaceLap = useMemo(() => {
    let bestMs: number | null = null
    let bestTime = ""
    let bestPilot = ""

    for (const r of displayRows) {
      const t = (r.migliorGiroGara || "").trim()
      const ms = parseMmSsMmm(t)
      if (ms == null) continue
      if (bestMs == null || ms < bestMs) {
        bestMs = ms
        bestTime = t
        bestPilot = r.pilota || ""
      }
    }

    return bestTime ? `${bestPilot || "?"}  ${bestTime}` : ""
  }, [displayRows])

    

    const finalRows = useMemo<DisplayRow[]>(() => {
    if (displayRows.length === 0) return []

    const useEditedOrderingForDg = shouldSyncDgTableWithManualEdits

    const detectedLeaderRow =
      displayRows.find((r) => parseAbsoluteRaceTimeMs(r.tempoTotaleGara) != null) ||
      displayRows.find((r) => r.posGara === 1) ||
      displayRows[0]

    const detectedLeaderMs = detectedLeaderRow
      ? parseAbsoluteRaceTimeMs(detectedLeaderRow.tempoTotaleGara)
      : null

    const orderedRows = useEditedOrderingForDg
      ? [...displayRows].sort((a, b) => {
          const aTempo = tempoLikeGt7(a)
          const bTempo = tempoLikeGt7(b)

          const aIsNonComparable = isNonComparableRaceValue(aTempo)
          const bIsNonComparable = isNonComparableRaceValue(bTempo)

          let aMs: number | null = null
          let bMs: number | null = null

          if (!aIsNonComparable && detectedLeaderMs != null) {
            aMs =
              parseAbsoluteRaceTimeMs(a.tempoTotaleGara) ??
              (a.posGara === 1
                ? parseAbsoluteRaceTimeMs(a.tempoTotaleGara)
                : (() => {
                    const gap = parseGapToMs(a.distaccoDalPrimo)
                    return gap != null ? detectedLeaderMs + gap : null
                  })())
          }

          if (!bIsNonComparable && detectedLeaderMs != null) {
            bMs =
              parseAbsoluteRaceTimeMs(b.tempoTotaleGara) ??
              (b.posGara === 1
                ? parseAbsoluteRaceTimeMs(b.tempoTotaleGara)
                : (() => {
                    const gap = parseGapToMs(b.distaccoDalPrimo)
                    return gap != null ? detectedLeaderMs + gap : null
                  })())
          }

          if (aMs != null && bMs != null) {
            if (aMs !== bMs) return aMs - bMs
            return a.posGara - b.posGara
          }

          if (aMs != null && bMs == null) return -1
          if (aMs == null && bMs != null) return 1

          return a.posGara - b.posGara
        })
      : [...displayRows].sort((a, b) => a.posGara - b.posGara)

    const leaderRow = orderedRows.find((r) => r.posGara === 1) || orderedRows[0]
    const leaderMs = leaderRow ? parseAbsoluteRaceTimeMs(leaderRow.tempoTotaleGara) : null

    if (leaderMs == null) {
      return orderedRows.map((r, i) => {
        const key = getPrtRowStableKey(r.sourcePosGara)
        const rawTempo = tempoLikeGt7(r)
        const isBaseDnf = /^(DNF|DNFV|DNF-I|DNF-V)$/i.test(rawTempo.trim())
        const dnfValue = isBaseDnf ? dnfOverrides[key] || "DNF-I" : null
        const rowHasDsqPenalty = hasDsqPenalty(penalties[key] || [])

        if (rowHasDsqPenalty) {
          return {
            ...r,
            posGara: i + 1,
            tempoTotaleGara: "DSQ",
            distaccoDalPrimo: "DSQ",
          }
        }

        if (dnfValue) {
          return {
            ...r,
            posGara: i + 1,
            tempoTotaleGara: dnfValue,
            distaccoDalPrimo: dnfValue,
          }
        }

        return { ...r, posGara: i + 1 }
      })
    }

    const comparable: Array<{
      orderedIndex: number
      row: DisplayRow
      penalizedMs: number
    }> = []

    const nonComparable: Array<{
      orderedIndex: number
      row: DisplayRow
    }> = []

    const dsqRows: Array<{
      orderedIndex: number
      row: DisplayRow
    }> = []

    const resolvedBaseMsByOrderedIndex = new Map<number, number>()

    for (let i = 0; i < orderedRows.length; i++) {
      const row = orderedRows[i]
      const key = getPrtRowStableKey(row.sourcePosGara)
      const rawTempo = tempoLikeGt7(row)
      const isDoppiato = isDoppiatoValue(rawTempo)
      const manualGap = (lapOverrides[key] || "").trim()

      let baseMs: number | null = null

      if (isDoppiato && manualGap) {
        const manualGapMs = parseManualLeaderGapInputMs(manualGap)
        const prevIndex = i - 1

        if (
          manualGapMs != null &&
          prevIndex >= 0 &&
          resolvedBaseMsByOrderedIndex.has(prevIndex)
        ) {
          const prevMs = resolvedBaseMsByOrderedIndex.get(prevIndex)!
          baseMs = prevMs + manualGapMs
        }
      } else {
        baseMs = resolveComparableRaceMs(row, leaderMs)
      }

      if (baseMs != null) {
        resolvedBaseMsByOrderedIndex.set(i, baseMs)
      }
    }

    for (let i = 0; i < orderedRows.length; i++) {
      const row = orderedRows[i]
      const key = getPrtRowStableKey(row.sourcePosGara)
      const rowHasDsqPenalty = hasDsqPenalty(penalties[key] || [])
      const isDsq =
        (row.tempoTotaleGara || "").trim().toUpperCase() === "DSQ" || rowHasDsqPenalty

      if (isDsq) {
        dsqRows.push({ orderedIndex: i, row })
        continue
      }

      const baseMs = resolvedBaseMsByOrderedIndex.get(i)
      if (baseMs == null) {
        nonComparable.push({ orderedIndex: i, row })
        continue
      }

      const penaltySec = totalPenaltySeconds(penalties[key] || [])

      comparable.push({
        orderedIndex: i,
        row,
        penalizedMs: baseMs + penaltySec * 1000,
      })
    }

    comparable.sort((a, b) => {
      if (a.penalizedMs !== b.penalizedMs) return a.penalizedMs - b.penalizedMs
      return a.orderedIndex - b.orderedIndex
    })

    const newLeader = comparable[0]?.penalizedMs ?? leaderMs

    const updatedComparable = comparable.map((item, idx) => {
      const isLeader = idx === 0
      return {
        ...item.row,
        posGara: idx + 1,
        tempoTotaleGara: formatAbsoluteRaceTime(item.penalizedMs),
        distaccoDalPrimo: isLeader ? "-" : formatGapFromLeader(item.penalizedMs - newLeader),
      }
    })

    const updatedNonComparable = nonComparable
      .sort((a, b) => a.orderedIndex - b.orderedIndex)
      .map((item, idx) => {
        const key = getPrtRowStableKey(item.row.sourcePosGara)
        const rawTempo = tempoLikeGt7(item.row)
        const isBaseDnf = /^(DNF|DNFV|DNF-I|DNF-V)$/i.test(rawTempo.trim())
        const dnfValue = isBaseDnf ? dnfOverrides[key] || "DNF-I" : null

        if (dnfValue) {
          return {
            ...item.row,
            posGara: updatedComparable.length + idx + 1,
            tempoTotaleGara: dnfValue,
            distaccoDalPrimo: dnfValue,
          }
        }

        return {
          ...item.row,
          posGara: updatedComparable.length + idx + 1,
        }
      })

    const updatedDsq = dsqRows
      .sort((a, b) => a.orderedIndex - b.orderedIndex)
      .map((item, idx) => ({
        ...item.row,
        posGara: updatedComparable.length + updatedNonComparable.length + idx + 1,
        tempoTotaleGara: "DSQ",
        distaccoDalPrimo: "DSQ",
      }))

    return [...updatedComparable, ...updatedNonComparable, ...updatedDsq]
  }, [displayRows, penalties, lapOverrides, dnfOverrides, shouldSyncDgTableWithManualEdits])

  

  const matchSummary = useMemo<PrtMatchSummary>(() => {
  if (finalRows.length === 0) {
    return {
      overallStatus: "warn",
      percentage: 0,
      fields: {
        posizione: "warn",
        pilota: "warn",
        auto: "warn",
        distacchi: "warn",
        pp: "warn",
        gv: "warn",
        gara: "warn",
        lobby: "warn",
        lega: "warn",
      },
      notes: ["Nessun dato da verificare."],
    }
  }

  const notes: string[] = []

  let posizione: MatchFieldStatus = "ok"
  let pilota: MatchFieldStatus = "ok"
  let auto: MatchFieldStatus = "ok"
  let distacchi: MatchFieldStatus = "ok"
  let pp: MatchFieldStatus = "ok"
  let gv: MatchFieldStatus = "ok"
  let gara: MatchFieldStatus = "ok"
  let lobby: MatchFieldStatus = "ok"
  let lega: MatchFieldStatus = "ok"

  // ---------------- POSIZIONI ----------------
  const positions = finalRows.map((r) => r.posGara)
  const isSequential = positions.every((p, i) => p === i + 1)

  if (!isSequential) {
    posizione = "error"
    notes.push("Ordine posizioni non consecutivo.")
  }

  // ---------------- PILOTI ----------------
  const names = finalRows.map((r) => (r.pilota || "").trim().toLowerCase())
  const hasEmptyName = names.some((n) => !n)
  const hasDuplicates = new Set(names).size !== names.length

  if (hasEmptyName) {
    pilota = "error"
    notes.push("Presente almeno un pilota vuoto.")
  } else if (hasDuplicates) {
    pilota = "warn"
    notes.push("Possibili piloti duplicati.")
  }

  // ---------------- AUTO ----------------
  const comparableAutoRows = finalRows.filter((r) => {
  const rawTempo = tempoLikeGt7(r).trim().toUpperCase()
  return rawTempo !== "DNP"
})

const autos = comparableAutoRows.map((r) => (r.auto || "").trim())
const hasEmptyAuto = autos.some((a) => !a)
const suspiciousAuto = autos.some((a) => a.length < 3)

if (hasEmptyAuto) {
  auto = "error"
  notes.push("Presente almeno un'auto vuota.")
} else if (suspiciousAuto) {
  auto = "warn"
  notes.push("Possibile auto anomala.")
}

  // ---------------- DISTACCHI ----------------
  const validDistacco = finalRows.every((r, i) => {
  if (i === 0) return true
  const d = (r.distaccoDalPrimo || "").trim()

  return (
    /^\+\d{1,2}:\d{2}\.\d{3}$/.test(d) ||
    /^\+\d{1,2}\.\d{3}$/.test(d) ||
    /^DNF$/i.test(d) ||
    /^DNFV$/i.test(d) ||
    /^DNF-I$/i.test(d) ||
    /^DNF-V$/i.test(d) ||
    /^DNP$/i.test(d) ||
    /^BOX$/i.test(d) ||
    /^DSQ$/i.test(d) ||
    /^DOPPIATO$/i.test(d) ||
    /^\d+giro$/i.test(d)
  )
})

  if (!validDistacco) {
    distacchi = "warn"
    notes.push("Almeno un distacco non standard.")
  }

  // ---------------- PP / GV ----------------
  const poleRows = finalRows.filter((r) => (r.pole || "").trim().toUpperCase() === "POLE")

  if (poleRows.length > 1) {
    pp = "error"
    notes.push("Più di una PP rilevata.")
  } else if (poleRows.length === 0) {
    pp = "warn"
    notes.push("PP non rilevata.")
  }

  let bestLapRowsCount = 0
  let bestLapMs: number | null = null

  for (const r of finalRows) {
    const ms = parseMmSsMmm((r.migliorGiroGara || "").trim())
    if (ms == null) continue

    if (bestLapMs == null || ms < bestLapMs) {
      bestLapMs = ms
      bestLapRowsCount = 1
    } else if (ms === bestLapMs) {
      bestLapRowsCount += 1
    }
  }

  if (bestLapMs == null) {
    gv = "warn"
    notes.push("GV non rilevata.")
  } else if (bestLapRowsCount > 1) {
    gv = "warn"
    notes.push("Possibile pari miglior giro.")
  }

  // ---------------- META ----------------
  const garaValue = String(effectiveGara || "").trim()
  const lobbyValue = String(unionMeta.lobby || "").trim()
  const legaValue = String(effectiveLegaResolved || "").trim()

  if (!garaValue || garaValue === "-") {
  gara = "warn"
  notes.push("Numero gara non rilevato.")
} else {
  const numericGara = Number(garaValue)

  if (!Number.isNaN(numericGara) && numericGara === 18) {
    gara = "warn"
    notes.push("Numero gara sospetto rilevato automaticamente. Inserisci manualmente.")
  }
}

  if (!lobbyValue && unionMode) {
    lobby = "warn"
    notes.push("Lobby non rilevata.")
  }

  if (!legaValue) {
    lega = "warn"
    notes.push("Lega non rilevata.")
  }

  const fields = {
    posizione,
    pilota,
    auto,
    distacchi,
    pp,
    gv,
    gara,
    lobby,
    lega,
  }

  const values = currentSprint === 2
    ? [
        fields.posizione,
        fields.pilota,
        fields.distacchi,
        fields.gv,
        fields.gara,
        fields.lobby,
        fields.lega,
      ]
    : Object.values(fields)

  const okCount = values.filter((v) => v === "ok").length
  const warnCount = values.filter((v) => v === "warn").length
  const errorCount = values.filter((v) => v === "error").length

  let percentage = 100
  let overallStatus: "ok" | "warn" | "error" = "ok"

  if (errorCount > 0) {
    overallStatus = "error"
    percentage = Math.round(((okCount + warnCount * 0.5) / values.length) * 100)
  } else if (warnCount > 0) {
    overallStatus = "warn"
    percentage = Math.round(((okCount + warnCount * 0.8) / values.length) * 100)
  }

  if (percentage < 0) percentage = 0
  if (percentage > 100) percentage = 100

  return {
    overallStatus,
    percentage,
    fields,
    notes,
  }
}, [finalRows, unionMeta, unionMode, effectiveGara, effectiveLega])

  const dgTableRows = useMemo<DisplayRow[]>(() => {
    if (!shouldSyncDgTableWithManualEdits) {
      return [...displayRows].sort((a, b) => a.posGara - b.posGara)
    }

    return [...finalRows].sort((a, b) => a.posGara - b.posGara)
  }, [shouldSyncDgTableWithManualEdits, displayRows, finalRows])

  const dgInfo = useMemo(() => {
    const leaderRow = dgTableRows.find((r) => r.posGara === 1) || dgTableRows[0]
    const leaderMs = leaderRow ? parseAbsoluteRaceTimeMs(leaderRow.tempoTotaleGara) : null

    return dgTableRows.map((row, index) => {
      const key = getPrtRowStableKey(row.sourcePosGara)
      const rawTempo = tempoLikeGt7(row)
      const isDoppiato = isDoppiatoValue(rawTempo)
      const isDnf = /^(DNF|DNFV)$/i.test(rawTempo.trim())
      const manualGap = (lapOverrides[key] || "").trim()
      const manualGapMs = isDoppiato ? parseManualLeaderGapInputMs(manualGap) : null
      const comparable = manualGapMs != null || isRowComparable(row, leaderMs)

      return {
        index,
        row,
        key,
        isDoppiato,
        isDnf,
        comparable,
        canEditPenalty: true,
        manualGap,
        manualGapValid: manualGap.length === 0 ? true : manualGapMs != null,
        manualGapMs,
      }
    })
  }, [dgTableRows, lapOverrides])

  const finalCsv = useMemo(
  () =>
    buildCsvFromRows(finalRows, {
      ...unionMeta,
      gara: normalizedGaraForOutput,
      lega: effectiveLegaResolved,
    }),
  [finalRows, unionMeta, normalizedGaraForOutput, effectiveLegaResolved]
)

  const hasAnyPenalty = useMemo(
    () => Object.values(penalties).some((entries) => (entries || []).length > 0),
    [penalties]
  )

  const winner = useMemo(() => finalRows[0]?.pilota || "-", [finalRows])

    const teamLookupPreview = useMemo(() => {
    return finalRows.map((row) => {
      const found = findTeamByPilot(row.pilota)
      return {
        pilota: row.pilota,
        team: found?.team || "-",
        lega: found?.lega || "-",
      }
    })
  }, [finalRows, teams])

  const bmwSprintDriversPreview = useMemo(() => {
  return buildBmwSprintDrivers(finalRows, bestRaceLap)
}, [finalRows, bestRaceLap])

const currentBmwSprintSnapshot = useMemo<BmwSprintSnapshot | null>(() => {
  if (displayRows.length === 0) return null

  return {
    sprint: currentSprint === 1 ? "sprint1" : "sprint2",
    hasQualifying: currentSprint === 1,
    savedAt: new Date().toISOString(),

    // SALVIAMO LA BASE, NON IL POST-PENALITÀ
    finalRows: displayRows,
    finalCsv: csv,
    unionMeta: {
      ...unionMeta,
      gara: normalizedGaraForOutput,
      lega: effectiveLegaResolved,
    },

    savedGara: normalizedGaraForOutput,
    savedLega: effectiveLegaResolved,

    winner,
    bestQuali: currentSprint === 1 ? bestQuali : "",
    bestRaceLap,

    drivers: bmwSprintDriversPreview,

    penalties,
    lapOverrides,
    dnfOverrides,
    manualPilotOverrides,
    manualAutoOverrides,
    manualDistaccoOverrides,
  }
}, [
  currentSprint,
  displayRows,
  csv,
  unionMeta,
  normalizedGaraForOutput,
  effectiveLegaResolved,
  winner,
  bestQuali,
  bestRaceLap,
  bmwSprintDriversPreview,
  penalties,
  lapOverrides,
  dnfOverrides,
  manualPilotOverrides,
  manualAutoOverrides,
  manualDistaccoOverrides,
])

const bmwLeagueDriversPreview = useMemo(() => {
  return buildBmwLeagueDriversFromSprints(
    savedSprintPreviews.sprint1,
    savedSprintPreviews.sprint2
  )
}, [savedSprintPreviews])
  
  const bmwRacePointsPreview = useMemo(() => {
    return buildBmwPilotRacePoints(finalRows)
  }, [finalRows, teams, bestRaceLap])

  const liveBmwTeamStandings = useMemo(() => {
  return buildLiveBmwTeamStandings(bmwRacePointsPreview, teams)
}, [bmwRacePointsPreview, teams])

const championshipTeams = useMemo(() => {
  return [...teams].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total
    return a.team.localeCompare(b.team)
  })
}, [teams])

const currentRoundKey = useMemo(() => getRoundKey(currentRound), [currentRound])

const currentRoundSnapshot = useMemo(() => {
  return roundSnapshots[currentRoundKey] || null
}, [roundSnapshots, currentRoundKey])

const savedLeagueInCurrentRound = useMemo(() => {
  const leagueName = getCurrentBmwLeagueName()
  if (!leagueName || !currentRoundSnapshot) return null
  return currentRoundSnapshot.leagues?.[leagueName] || null
}, [currentRoundSnapshot, effectiveLega])

const roundLeagueStatus = useMemo(() => {
  const pro = currentRoundSnapshot?.leagues?.["PRO"] || null
  const proAma = currentRoundSnapshot?.leagues?.["PRO-AMA"] || null
  const ama = currentRoundSnapshot?.leagues?.["AMA"] || null

  return {
    PRO: isLeagueSnapshotComplete(pro),
    "PRO-AMA": isLeagueSnapshotComplete(proAma),
    AMA: isLeagueSnapshotComplete(ama),
  }
}, [currentRoundSnapshot])

const isCurrentRoundReady = useMemo(() => {
  return isRoundSnapshotReady(currentRoundSnapshot)
}, [currentRoundSnapshot])

const isCurrentRoundAlreadySaved = useMemo(() => {
  return currentRoundSnapshot?.status === "consolidated"
}, [currentRoundSnapshot])

const savedLeaguesInCurrentRound = useMemo(() => {
  if (!currentRoundSnapshot?.leagues) return []

  return (["PRO", "PRO-AMA", "AMA"] as BmwLeagueName[])
    .map((league) => ({
      league,
      snapshot: currentRoundSnapshot.leagues?.[league] || null,
    }))
    .filter((item) => !!item.snapshot)
}, [currentRoundSnapshot])

const hasSavedLeaguesInCurrentRound = savedLeaguesInCurrentRound.length > 0

const currentRoundHasUnsavedWork = useMemo(() => {
  const hasLiveExtraction =
    rows.length > 0 ||
    finalRows.length > 0 ||
    csv.trim().length > 0 ||
    files.length > 0

  const hasSavedSprintWork =
    !!savedSprintPreviews.sprint1 || !!savedSprintPreviews.sprint2

  const hasManualWork =
    Object.keys(penalties).length > 0 ||
    Object.keys(lapOverrides).length > 0 ||
    Object.keys(dnfOverrides).length > 0 ||
    Object.keys(manualPilotOverrides).length > 0 ||
    Object.keys(manualAutoOverrides).length > 0 ||
    Object.keys(manualDistaccoOverrides).length > 0

  const currentSnapshot = roundSnapshots[getRoundKey(currentRound)]
  const currentRoundIncomplete = !!currentSnapshot && !isRoundSnapshotReady(currentSnapshot)

  return hasLiveExtraction || hasSavedSprintWork || hasManualWork || currentRoundIncomplete
}, [
  rows,
  finalRows,
  csv,
  files,
  savedSprintPreviews,
  penalties,
  lapOverrides,
  dnfOverrides,
  manualPilotOverrides,
  manualAutoOverrides,
  manualDistaccoOverrides,
  roundSnapshots,
  currentRound,
])

function requestRoundChange(nextRound: 1 | 2 | 3 | 4) {
  if (nextRound === currentRound) return

  if (!currentRoundHasUnsavedWork) {
    setCurrentRound(nextRound)
    return
  }

  setPendingRoundChange(nextRound)
  setShowRoundChangeConfirmModal(true)
}

function confirmRoundChange() {
  if (pendingRoundChange == null) return

  setCurrentRound(pendingRoundChange)

  // reset area di lavoro sprint quando cambio round
  setSavedSprintPreviews({
    sprint1: null,
    sprint2: null,
  })

  setCurrentSprint(1)
  setFiles([])
  setCsv("")
  setRows([])
  setUnionMeta({ gara: "", lobby: "", lega: "" })

  setManualGaraOverride("")
  setManualLegaOverride("")
  setPenalties({})
  setLapOverrides({})
  setDnfOverrides({})
  setManualPilotOverrides({})
  setManualAutoOverrides({})
  setManualDistaccoOverrides({})
  setManualPilotDraft({})
  setManualDistaccoDraft({})
  setPilotModalRows([])

  setShowPilotModal(false)
  setShowDistaccoModal(false)
  setShowDgTable(false)
  setShowSprintInfo(false)
  setShowSprint2UploadConfirm(false)
  setShowSprint2DoneInfo(false)
  setShowSprintResetConfirm(false)
  setSprint2Ready(false)
  setPendingSprint2Upload(false)
  setIsReopenedSavedSprint(false)
  setReopenedSprintKey(null)

  setPendingRoundChange(null)
  setShowRoundChangeConfirmModal(false)
}

function cancelRoundChange() {
  setPendingRoundChange(null)
  setShowRoundChangeConfirmModal(false)
}

async function performExportTablePng() {
    if (!exportRef.current || finalRows.length === 0) return

    try {
      setExporting(true)
      await new Promise((resolve) => setTimeout(resolve, 140))

      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        width: 1920,
        height: 1080,
        canvasWidth: 1920,
        canvasHeight: 1080,
        backgroundColor: "#07080c",
        style: {
          transform: "scale(1)",
          transformOrigin: "top left",
        },
      })

      const link = document.createElement("a")
      link.download = "albixximo_classifica_output.png"
      link.href = dataUrl
      link.click()
    } catch (e: any) {
      setError(`Errore esportazione PNG: ${String(e?.message || e)}`)
    } finally {
      setExporting(false)
    }
  }

  async function performExportGeneralTeamsPng() {
  if (!teamGeneralExportRef.current || championshipTeams.length === 0) return

  try {
    setExportingGeneralTeamsPng(true)
    await new Promise((resolve) => setTimeout(resolve, 140))

    const dataUrl = await toPng(teamGeneralExportRef.current, {
      cacheBust: true,
      pixelRatio: 2,
      width: 1920,
      height: 1080,
      canvasWidth: 1920,
      canvasHeight: 1080,
      backgroundColor: "#07080c",
      style: {
        transform: "scale(1)",
        transformOrigin: "top left",
      },
    })

    const link = document.createElement("a")
    link.download = `bmw_m2_team_cup_classifica_generale_r${currentRound}.png`
    link.href = dataUrl
    link.click()
  } catch (e: any) {
    setError(`Errore esportazione PNG classifica generale team: ${String(e?.message || e)}`)
  } finally {
    setExportingGeneralTeamsPng(false)
  }
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderTempoHtml(tempo: string) {
  const t = String(tempo || "").trim()
  const upper = t.toUpperCase()

  if (!t || t === "-") return `<span class="tempo-text">-</span>`
  if (upper === "DNF") return `<span class="pill teal">DNF</span>`
  if (upper === "DNFV") return `<span class="pill teal">DNFV</span>`
  if (upper === "DNP") return `<span class="pill teal">DNP</span>`
  if (upper === "BOX") return `<span class="pill fuchsia">BOX</span>`
  if (/^\d+giro$/i.test(t) || upper === "DOPPIATO") return `<span class="pill orange">DOPPIATO</span>`
  if (upper === "DSQ") return `<span class="pill dsq">DSQ</span>`

  return `<span class="tempo-text">${escapeHtml(t)}</span>`
}

function renderHeaderBadgeHtml(
  label: string,
  value: string,
  variant: "gold" | "violet" | "silver"
) {
  const palette =
    variant === "gold"
      ? {
          border: "rgba(255,215,0,0.70)",
          glow: "rgba(255,215,0,0.16)",
          tagBg: "rgba(255,215,0,0.10)",
          tagBorder: "rgba(255,215,0,0.28)",
          tagText: "#ffe58a",
        }
      : variant === "silver"
        ? {
            border: "rgba(210,215,225,0.72)",
            glow: "rgba(210,215,225,0.18)",
            tagBg: "rgba(210,215,225,0.10)",
            tagBorder: "rgba(210,215,225,0.24)",
            tagText: "#f3f6fb",
          }
        : {
            border: "rgba(160,90,255,0.70)",
            glow: "rgba(160,90,255,0.14)",
            tagBg: "rgba(160,90,255,0.10)",
            tagBorder: "rgba(160,90,255,0.28)",
            tagText: "#dfc2ff",
          }

  const rawValue = String(value || "").trim()
  const parts = rawValue.split(/\s{2,}/)
  const mainValue = parts[0] || "-"
  const secondaryValue = parts[1] || ""

  return `
    <div class="header-badge">
      <span
        class="header-badge-label"
        style="
          border: 1px solid ${palette.border};
          box-shadow: 0 0 22px ${palette.glow};
        "
      >
        ${escapeHtml(label)}
      </span>

      <span class="header-badge-value-wrap">
        <span class="header-badge-main">
          ${escapeHtml(mainValue)}
        </span>
        ${
          secondaryValue
            ? `
          <span
            class="header-badge-secondary"
            style="
              background: ${palette.tagBg};
              border: 1px solid ${palette.tagBorder};
              color: ${palette.tagText};
              box-shadow: 0 0 12px ${palette.glow};
            "
          >
            ${escapeHtml(secondaryValue)}
          </span>
        `
            : ""
        }
      </span>
    </div>
  `
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Impossibile caricare immagine: ${url}`)
  }

  const blob = await res.blob()

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Conversione immagine in base64 fallita"))
    reader.readAsDataURL(blob)
  })
}

async function downloadExtendedHtmlExport(customTexts?: {
  mainTitle: string
  sideLabel: string
  subtitle: string
}) {
  if (finalRows.length === 0) return

  try {
    setExportingHtml(true)

    const texts = customTexts ?? exportTexts

    const logoUrl = `${window.location.origin}/bmw-m2-team-cup.png`

    let logoDataUrl = ""
    try {
      logoDataUrl = await urlToDataUrl(logoUrl)
    } catch {
      logoDataUrl = ""
    }

    const summaryHtml = [
      renderHeaderBadgeHtml("WINNER", winner || "-", "silver"),
      `<span class="separator"></span>`,
      renderHeaderBadgeHtml("POLE (QUALIFICA)", bestQuali || "-", "gold"),
      `<span class="separator"></span>`,
      renderHeaderBadgeHtml("BEST LAP (GARA)", bestRaceLap || "-", "violet"),
      `<span class="separator"></span>`,
      renderHeaderBadgeHtml("LEGA", effectiveLega || "-", "gold"),
      `<span class="separator"></span>`,
      renderHeaderBadgeHtml("GARA", normalizedGaraForOutput || "-", "violet"),
      ...(unionMode
        ? [
            `<span class="separator"></span>`,
            renderHeaderBadgeHtml("LOBBY", unionMeta.lobby || "-", "gold"),
          ]
        : []),
    ].join("")

    const rowsHtml = finalRows
      .map((r, i) => {
        const tempo = tempoLikeGt7(r)
        const resolvedTeamName = findTeamByPilot(r.pilota)?.team || "-"

        const isPole = (r.pole || "").trim().toUpperCase() === "POLE"
        const bestLapTime = (bestRaceLap.split("  ").pop() || "").trim()
        const isBestLap = !!bestLapTime && (r.migliorGiroGara || "").trim() === bestLapTime

        const penaltyHtml = renderPenaltyHtmlForExport(r, penalties)
        const pointsHtml = renderPointsHtmlForExport(r, bestRaceLap)

        let rowClass = "row-even"
        if (r.posGara === 1) rowClass = "row-p1"
        else if (r.posGara === 2) rowClass = "row-p2"
        else if (r.posGara === 3) rowClass = "row-p3"
        else if (i % 2 !== 0) rowClass = "row-odd"

        let qualiHtml = `<span>${escapeHtml(r.tempoQualifica || "-")}</span>`
        if (currentSprint === 2) {
          qualiHtml = `<span class="grid-reverse">Griglia invertita</span>`
        } else if (isPole) {
          qualiHtml = `<span class="pill gold">POLE <span class="pill-right">${escapeHtml(
            r.tempoQualifica || "-"
          )}</span></span>`
        }

        let bestLapHtml = `<span>${escapeHtml(r.migliorGiroGara || "-")}</span>`
        if (isBestLap && r.migliorGiroGara) {
          bestLapHtml = `<span class="pill violet">BEST LAP <span class="pill-right">${escapeHtml(
            r.migliorGiroGara
          )}</span></span>`
        }

        let posBadge = escapeHtml(String(r.posGara))
        if (r.posGara === 1) posBadge = "🥇"
        else if (r.posGara === 2) posBadge = "🥈"
        else if (r.posGara === 3) posBadge = "🥉"

        return `
          <tr class="${rowClass}">
            <td class="pos-cell col-pos"><span class="pos-badge">${posBadge}</span></td>
            <td class="pilot-cell col-pilot">${escapeHtml(r.pilota)}</td>
            <td class="team-cell col-team">
              <div class="team-wrap">
                <div class="bmw-stripes">
                  <span class="stripe blue"></span>
                  <span class="stripe violet"></span>
                  <span class="stripe red"></span>
                </div>
                <span class="team-name">${escapeHtml(resolvedTeamName)}</span>
              </div>
            </td>
            <td class="right mono col-quali">${qualiHtml}</td>
            <td class="right mono col-race">${renderTempoHtml(tempo)}</td>
            <td class="center mono col-penalty">${penaltyHtml}</td>
            <td class="right mono col-bestlap">${bestLapHtml}</td>
            <td class="center mono col-points">${pointsHtml}</td>
          </tr>
        `
      })
      .join("")

    const headerLogoHtml = logoDataUrl
      ? `
        <div class="header-right">
          <div class="header-logo-link" title="BMW M2 TEAM CUP">
            <div class="header-logo-frame">
              <img class="header-logo" src="${escapeHtml(logoDataUrl)}" alt="BMW M2 TEAM CUP" />
            </div>
          </div>
        </div>
      `
      : ""

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BMW M2 TEAM CUP - Export HTML</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      color: white;
      background:
        radial-gradient(1200px 600px at 15% 10%, rgba(255,215,0,0.14), transparent 50%),
        radial-gradient(900px 500px at 85% 20%, rgba(160,90,255,0.16), transparent 50%),
        linear-gradient(180deg, #0b0d12 0%, #07080c 100%);
      min-height: 100vh;
      overflow-y: auto;
    }

    .page {
      max-width: 1680px;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 16px;
    }

    .card {
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.05);
      box-shadow: 0 14px 60px rgba(0,0,0,0.45);
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: nowrap;
      padding: 16px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
    }

    .header::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(900px 220px at 10% 10%, rgba(255,215,0,0.18), transparent 60%),
        radial-gradient(700px 220px at 90% 0%, rgba(160,90,255,0.18), transparent 55%);
      opacity: 0.9;
    }

    .header-left {
      position: relative;
      min-width: 0;
      flex: 1 1 auto;
      z-index: 1;
    }

    .header-right {
      position: relative;
      z-index: 1;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-logo-link {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      flex-shrink: 0;
      border-radius: 20px;
      padding: 2px;
      background: linear-gradient(90deg, #00A0FF, #4C4CFF, #FF1E1E);
      box-shadow:
        0 8px 24px rgba(0,0,0,0.4),
        0 0 14px rgba(0,163,255,0.12),
        0 0 14px rgba(123,97,255,0.10),
        0 0 14px rgba(255,59,59,0.10);
    }

    .header-logo-frame {
      border-radius: 18px;
      padding: 6px;
      background: #07080c;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-logo {
      height: 110px;
      width: auto;
      border-radius: 14px;
      display: block;
    }

    .title-line {
      display: flex;
      align-items: center;
      gap: 10px;
      row-gap: 8px;
      flex-wrap: wrap;
      white-space: normal;
      min-width: 0;
    }

    .main-title {
      font-size: 34px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      line-height: 1.05;
      text-shadow: 0 0 18px rgba(255,215,0,0.22);
      white-space: nowrap;
      min-width: 0;
    }

    .side-label {
      font-size: 14px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .subtitle {
      margin-top: 5px;
      font-size: 13px;
      opacity: 0.9;
      white-space: nowrap;
    }

    .title-bar {
      margin-top: 8px;
      height: 7px;
      border-radius: 999px;
      background:
        linear-gradient(
          90deg,
          rgba(255,215,0,0.0) 0%,
          rgba(255,215,0,0.35) 18%,
          rgba(255,255,255,0.14) 50%,
          rgba(160,90,255,0.30) 82%,
          rgba(160,90,255,0.0) 100%
        );
      box-shadow: 0 0 18px rgba(255,215,0,0.14);
      opacity: 0.9;
    }

    .summary {
      padding: 18px 20px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      display: flex;
      flex-wrap: nowrap;
      gap: 14px;
      align-items: center;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: nowrap;
      white-space: nowrap;
      flex: 0 0 auto;
    }

    .header-badge-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 9px 14px;
      border-radius: 999px;
      font-weight: 900;
      font-size: 12px;
      line-height: 1;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(0,0,0,0.20);
      color: white;
      flex-shrink: 0;
    }

    .header-badge-value-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: white;
      white-space: nowrap;
      flex-shrink: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .header-badge-main {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      font-weight: 900;
      font-size: 16px;
      line-height: 1;
      letter-spacing: 0.2px;
    }

    .header-badge-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 13px;
      line-height: 1;
      letter-spacing: 0.15px;
      font-variant-numeric: tabular-nums;
    }

    .separator {
      width: 2px;
      height: 32px;
      border-radius: 2px;
      background: linear-gradient(to bottom, transparent, rgba(210,215,225,0.9), transparent);
      box-shadow: 0 0 6px rgba(210,215,225,0.35);
      flex-shrink: 0;
    }

    .table-card {
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.22);
      overflow: hidden;
    }

    .table-head {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.10);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      font-weight: 900;
    }

    .table-wrap {
      overflow-x: auto;
      overflow-y: visible;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: rgba(10,12,18,0.96);
      backdrop-filter: blur(10px);
      padding: 18px 14px;
      text-align: left;
      font-size: 13px;
      opacity: 0.82;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    tbody td {
      padding: 18px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      vertical-align: middle;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .col-pos { width: 60px; }
    .col-pilot { width: 200px; }
    .col-team { width: 220px; }
    .col-quali { width: 160px; }
    .col-race { width: 160px; }
    .col-penalty { width: 200px; }
    .col-bestlap { width: 200px; }
    .col-points { width: 90px; }

    .row-p1 {
      background: linear-gradient(90deg, rgba(255,215,0,0.11) 0%, rgba(255,215,0,0.05) 28%, rgba(255,255,255,0.02) 70%);
    }

    .row-p2 {
      background: linear-gradient(90deg, rgba(220,220,220,0.10) 0%, rgba(220,220,220,0.04) 28%, rgba(255,255,255,0.02) 70%);
    }

    .row-p3 {
      background: linear-gradient(90deg, rgba(205,127,50,0.12) 0%, rgba(205,127,50,0.05) 28%, rgba(255,255,255,0.02) 70%);
    }

    .row-even { background: rgba(255,255,255,0.02); }
    .row-odd { background: rgba(0,0,0,0.10); }

    .pos-cell { text-align: center; }

    .pos-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 28px;
      padding: 0 10px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.22);
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .pilot-cell {
      font-size: 21px;
      font-weight: 800;
      letter-spacing: 0.03em;
      color: #ffffff;
    }

    .team-cell { max-width: 360px; }

    .team-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .bmw-stripes {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      transform: skewX(-16deg);
      transform-origin: center;
    }

    .stripe {
      width: 6px;
      height: 24px;
      border-radius: 2px;
      display: inline-block;
    }

    .stripe.blue {
      background: linear-gradient(180deg, #6fd3ff 0%, #3bb4e6 100%);
      box-shadow: 0 0 6px rgba(91,192,255,0.4);
    }

    .stripe.violet {
      background: linear-gradient(180deg, #8b5dff 0%, #6a3dff 100%);
      box-shadow: 0 0 6px rgba(124,77,255,0.4);
    }

    .stripe.red {
      background: linear-gradient(180deg, #ff6666 0%, #ff2f2f 100%);
      box-shadow: 0 0 6px rgba(255,59,59,0.4);
    }

    .team-name {
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: rgba(255,255,255,0.92);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .right { text-align: right; }
    .center { text-align: center; }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      min-height: 40px;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      white-space: nowrap;
      color: rgba(0,0,0,0.92);
      line-height: 1;
    }

    .pill-right {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      padding-left: 10px;
      border-left: 1px solid rgba(0,0,0,0.22);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      letter-spacing: 0.2px;
      text-transform: none;
      font-size: 15px;
      line-height: 1;
    }

    .gold {
      background: rgba(255,215,0,0.92);
      border: 1px solid rgba(255,215,0,0.55);
      box-shadow: 0 0 22px rgba(255,215,0,0.20);
    }

    .violet {
      background: rgba(160,90,255,0.92);
      border: 1px solid rgba(160,90,255,0.55);
      box-shadow: 0 0 22px rgba(160,90,255,0.18);
    }

    .orange {
      background: rgba(255,165,0,0.92);
      border: 1px solid rgba(255,165,0,0.55);
      box-shadow: 0 0 22px rgba(255,165,0,0.16);
    }

    .teal {
      background: rgba(64,224,208,0.92);
      border: 1px solid rgba(64,224,208,0.55);
      box-shadow: 0 0 22px rgba(64,224,208,0.14);
    }

    .fuchsia {
      background: rgba(255,0,128,0.92);
      border: 1px solid rgba(255,0,128,0.55);
      box-shadow: 0 0 22px rgba(255,0,128,0.18);
    }

    .dsq {
      background: rgba(255,0,255,0.92);
      border: 1px solid rgba(255,0,255,0.60);
      box-shadow: 0 0 22px rgba(255,0,255,0.30);
    }

    .tempo-text {
      font-size: 18px;
    }

    .grid-reverse {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 8px 13px;
      border-radius: 999px;
      border: 1px solid rgba(96,165,250,0.25);
      background: linear-gradient(180deg, rgba(96,165,250,0.14), rgba(59,130,246,0.06));
      box-shadow: 0 0 10px rgba(96,165,250,0.08);
      color: rgba(219,234,254,0.85);
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      white-space: nowrap;
      line-height: 1;
    }

    .penalty-total {
      color: #ff2d2d;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 16px;
      line-height: 1;
      white-space: nowrap;
    }

    .penalty-ammonition {
      color: #f59e0b;
    }

    .points-pill {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      line-height: 1;
    }

    .points-p1 {
      background: linear-gradient(180deg, rgba(255,215,0,1), rgba(255,200,0,0.95));
      border: 1px solid rgba(255,215,0,0.55);
      box-shadow: 0 0 18px rgba(255,215,0,0.35);
      color: rgba(0,0,0,0.95);
      font-size: 12px;
    }

    .points-p2 {
      background: linear-gradient(180deg, rgba(220,220,220,0.96), rgba(185,185,185,0.96));
      border: 1px solid rgba(220,220,220,0.42);
      box-shadow: 0 0 14px rgba(220,220,220,0.22);
      color: rgba(0,0,0,0.95);
      font-size: 12px;
    }

    .points-p3 {
      background: linear-gradient(180deg, rgba(205,127,50,0.96), rgba(168,102,38,0.96));
      border: 1px solid rgba(205,127,50,0.45);
      box-shadow: 0 0 14px rgba(205,127,50,0.22);
      color: rgba(0,0,0,0.95);
      font-size: 12px;
    }

    .points-pill.normal {
      border: 1px solid rgba(255,255,255,0.22);
      background: transparent;
      color: #ffffff;
      box-shadow: none;
      font-size: 15px;
      text-shadow: 0 0 8px rgba(255,255,255,0.10);
    }

    .points-stars {
      position: absolute;
      top: -6px;
      right: -9px;
      display: flex;
      gap: 1px;
      font-size: 10px;
      line-height: 1;
    }

    .points-stars.double {
      right: -14px;
    }

    .star-gold {
      color: #ffd700;
      text-shadow: 0 0 6px rgba(255,215,0,0.45);
    }

    .star-violet {
      color: #b67cff;
      text-shadow: 0 0 6px rgba(160,90,255,0.45);
    }

    .footer-note {
      font-size: 12px;
      opacity: 0.72;
      padding: 0 4px;
    }

    @media (max-width: 980px) {
      .header {
        flex-wrap: wrap;
        align-items: flex-start;
      }

      .header-right {
        width: 100%;
        justify-content: flex-start;
      }

      .header-logo {
        height: 84px;
        max-width: 100%;
      }

      .page {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card header">
      <div class="header-left">
        <div class="title-line">
          <div class="main-title">${escapeHtml(texts.mainTitle)}</div>
          <span class="side-label">${escapeHtml(texts.sideLabel)}</span>
        </div>
        <div class="subtitle">${escapeHtml(texts.subtitle)}</div>
        <div class="title-bar"></div>
      </div>
      ${headerLogoHtml}
    </div>

    <div class="summary">
      ${summaryHtml}
    </div>

    <div class="table-card">
      <div class="table-head">
        <div>Classifica Sprint ${escapeHtml(String(currentSprint))} estesa</div>
        <div>${escapeHtml(String(finalRows.length))} partecipanti</div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-pos">Pos</th>
              <th class="col-pilot">Pilota</th>
              <th class="col-team">Team</th>
              <th class="col-quali" style="text-align:right;">Qualifica</th>
              <th class="col-race" style="text-align:right;">Tempi gara</th>
              <th class="col-penalty" style="text-align:center;">Penalità</th>
              <th class="col-bestlap" style="text-align:right;">Miglior giro</th>
              <th class="col-points" style="text-align:center;">Punti</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer-note">
      Export HTML esteso • scroll verticale • PNG invariato
    </div>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = "bmw_m2_team_cup_sprint_" + currentSprint + "_esteso.html"
    link.click()

    URL.revokeObjectURL(url)
  } catch (e: any) {
    setError("Errore export HTML: " + String(e?.message || e))
  } finally {
    setExportingHtml(false)
  }
}

async function downloadGeneralTeamsHtmlExport(customTexts?: {
  mainTitle: string
  sideLabel: string
  subtitle: string
}) {
  if (championshipTeams.length === 0) return

  try {
    setExportingGeneralTeamsHtml(true)

    const texts = customTexts ?? exportTexts

    const logoUrl = `${window.location.origin}/bmw-m2-team-cup.png`
const splashUrl = `${window.location.origin}/bmw-splash.png`

let logoDataUrl = ""
try {
  logoDataUrl = await urlToDataUrl(logoUrl)
} catch {
  logoDataUrl = ""
}

let splashDataUrl = ""
try {
  splashDataUrl = await urlToDataUrl(splashUrl)
} catch {
  splashDataUrl = ""
}

const splashImgSrc = splashDataUrl || logoDataUrl

    const currentLeader = championshipTeams[0]?.team || "-"
    const currentLeaderPoints = String(championshipTeams[0]?.total ?? 0)

    const headerLogoHtml = logoDataUrl
      ? `
        <div class="header-right">
          <div class="header-logo-link" title="BMW M2 TEAM CUP">
            <div class="header-logo-frame">
              <img class="header-logo" src="${escapeHtml(logoDataUrl)}" alt="BMW M2 TEAM CUP" />
            </div>
          </div>
        </div>
      `
      : ""

    const summaryHtml = [
      renderHeaderBadgeHtml(
        "ROUND ATTUALE",
        `Dati aggiornati dopo Round ${currentRound}`,
        "gold"
      ),
      `<span class="separator"></span>`,
      renderHeaderBadgeHtml("TEAM LEADER", currentLeader, "silver"),
      `<span class="separator"></span>`,
      renderHeaderBadgeHtml("PUNTI LEADER", currentLeaderPoints, "violet"),
    ].join("")

    const rowsHtml = championshipTeams
      .map((team, idx) => {
        const pos = idx + 1
        const isP1 = pos === 1
        const isP2 = pos === 2
        const isP3 = pos === 3

        const rowClass = isP1
          ? "row-p1"
          : isP2
            ? "row-p2"
            : isP3
              ? "row-p3"
              : idx % 2 === 0
                ? "row-even"
                : "row-odd"

        const posBadge =
          pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : escapeHtml(String(pos))

        const totalClass = isP1
          ? "team-total team-total-p1"
          : isP2
            ? "team-total team-total-p2"
            : isP3
              ? "team-total team-total-p3"
              : "team-total team-total-normal"

        const roundDetailCells = [1, 2, 3, 4]
          .map((round) => {
            const s1 = getTeamRoundDetail(team.team, round, "sprint1")
            const s2 = getTeamRoundDetail(team.team, round, "sprint2")

            return `
              <td class="col-round-detail">
                <div class="round-detail-wrap">
                  <div class="sprint-line">
                    <div class="round-mini-grid">
                      <div class="round-mini-cell">${renderMiniRoundDetailHtml(s1.pro)}</div>
                      <div class="round-mini-cell">${renderMiniRoundDetailHtml(s1.proAma)}</div>
                      <div class="round-mini-cell">${renderMiniRoundDetailHtml(s1.ama)}</div>
                    </div>
                  </div>

                  <div class="sprint-line">
                    <div class="round-mini-grid">
                      <div class="round-mini-cell">${renderMiniRoundDetailHtml(s2.pro)}</div>
                      <div class="round-mini-cell">${renderMiniRoundDetailHtml(s2.proAma)}</div>
                      <div class="round-mini-cell">${renderMiniRoundDetailHtml(s2.ama)}</div>
                    </div>
                  </div>
                </div>
              </td>
            `
          })
          .join("")

        const roundTotalsHtml = (["r1", "r2", "r3", "r4"] as RoundKey[])
          .map((roundKey) => {
            const value = team.rounds[roundKey] || 0

            return `
              <td class="round-total-cell ${value > 0 ? "round-total-on" : "round-total-off"}">
                ${escapeHtml(String(value))}
              </td>
            `
          })
          .join("")

        return `
          <tr class="${rowClass}">
            <td class="col-pos pos-cell">
              <span class="pos-badge">${posBadge}</span>
            </td>

            <td class="col-team team-cell">
              <div class="team-wrap">
                <div class="bmw-stripes">
                  <span class="stripe blue"></span>
                  <span class="stripe violet"></span>
                  <span class="stripe red"></span>
                </div>
                <span class="team-name">${escapeHtml(team.team)}</span>
              </div>
            </td>

            <td class="col-sprint-labels">
              <div class="sprint-labels-wrap">
                <span class="sprint-pill sprint-pill-s1">S1</span>
                <span class="sprint-pill sprint-pill-s2">S2</span>
              </div>
            </td>

            ${roundDetailCells}

            ${roundTotalsHtml}

            <td class="col-total total-cell">
              <span class="${totalClass}">${team.total}</span>
            </td>
          </tr>
        `
      })
      .join("")

    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BMW M2 TEAM CUP - Classifica Generale TEAM</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }

    #bmwExportSplash {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: #05070b;
  display: flex;
  flex-direction: column; /* 🔥 AGGIUNGI QUESTA */
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

#bmwExportSplash.splash-hide {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 900ms ease, visibility 900ms ease;
}

.bmw-splash-card {
  width: min(74vw, 960px);
  border-radius: 28px;
  overflow: hidden;
  display: block;
  line-height: 0;
  animation: bmwExportGlowCycle 4s ease-in-out infinite;
}

.bmw-splash-card img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 28px;
}

.bmw-splash-loader {
  position: static; /* 🔥 CAMBIO QUI */
  transform: none;
  margin-top: 20px;
  display: grid;
  gap: 10px;
  justify-items: center;
  width: min(74vw, 720px);
}

.bmw-splash-loading-text {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: #ffffff;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.18);
  animation: bmwExportTextGlow 3s ease-in-out infinite;
  box-shadow: 0 0 20px rgba(0,0,0,0.35);
}

.bmw-splash-slashes {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
}

.bmw-splash-slashes span {
  font-size: 18px;
  font-weight: 900;
  letter-spacing: -1px;
  animation: bmwExportSlashPulse 1.15s ease-in-out infinite;
}

.bmw-splash-slashes span:nth-child(3n + 1) {
  color: #6fd3ff;
  text-shadow: 0 0 10px rgba(111,211,255,0.35);
}

.bmw-splash-slashes span:nth-child(3n + 2) {
  color: #6a3dff;
  text-shadow: 0 0 10px rgba(106,61,255,0.35);
}

.bmw-splash-slashes span:nth-child(3n) {
  color: #ff3b3b;
  text-shadow: 0 0 10px rgba(255,59,59,0.35);
}

#bmwExportSplashFallback {
  color: white;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 40px;
}

@keyframes bmwExportSlashPulse {
  0% { opacity: 0.22; transform: translateY(0px) scale(0.96); }
  50% { opacity: 1; transform: translateY(-1px) scale(1); }
  100% { opacity: 0.22; transform: translateY(0px) scale(0.96); }
}

@keyframes bmwExportGlowCycle {
  0% {
    box-shadow:
      0 0 40px rgba(111,211,255,0.35),
      0 0 80px rgba(111,211,255,0.18);
  }
  33% {
    box-shadow:
      0 0 40px rgba(106,61,255,0.35),
      0 0 80px rgba(106,61,255,0.18);
  }
  66% {
    box-shadow:
      0 0 40px rgba(255,59,59,0.35),
      0 0 80px rgba(255,59,59,0.18);
  }
  100% {
    box-shadow:
      0 0 40px rgba(111,211,255,0.35),
      0 0 80px rgba(111,211,255,0.18);
  }
}

@keyframes bmwExportTextGlow {
  0% {
    text-shadow:
      0 0 6px rgba(111,211,255,0.6),
      0 0 12px rgba(111,211,255,0.3);
    opacity: 0.85;
  }
  33% {
    text-shadow:
      0 0 6px rgba(106,61,255,0.6),
      0 0 12px rgba(106,61,255,0.3);
    opacity: 1;
  }
  66% {
    text-shadow:
      0 0 6px rgba(255,59,59,0.6),
      0 0 12px rgba(255,59,59,0.3);
    opacity: 0.9;
  }
  100% {
    text-shadow:
      0 0 6px rgba(111,211,255,0.6),
      0 0 12px rgba(111,211,255,0.3);
    opacity: 0.85;
  }
}

    body {
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  color: white;
  background: linear-gradient(180deg, #0b0d12 0%, #07080c 100%);
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: auto;
  position: relative;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 0%, rgba(255,215,0,0.08), transparent 60%),
    radial-gradient(circle at 80% 0%, rgba(160,90,255,0.08), transparent 60%);
}

    .page {
      width: max-content;
      min-width: 100%;
      max-width: none;
      margin: 0 auto;
      padding: 24px;
      display: grid;
      gap: 18px;
    }

    .card {
      border-radius: 22px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(255,255,255,0.05);
      box-shadow: 0 14px 60px rgba(0,0,0,0.45);
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      flex-wrap: nowrap;
      padding: 16px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
    }

    .header::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(65% 120% at 12% 0%, rgba(255,215,0,0.16), transparent 68%),
        radial-gradient(58% 120% at 88% 0%, rgba(160,90,255,0.16), transparent 68%);
      opacity: 0.9;
    }

    .header-left {
      position: relative;
      min-width: 0;
      flex: 1 1 auto;
      z-index: 1;
    }

    .header-right {
      position: relative;
      z-index: 1;
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-logo-link {
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      flex-shrink: 0;
      border-radius: 20px;
      padding: 2px;
      background: linear-gradient(90deg, #00A0FF, #4C4CFF, #FF1E1E);
      box-shadow:
        0 8px 24px rgba(0,0,0,0.4),
        0 0 14px rgba(0,163,255,0.12),
        0 0 14px rgba(123,97,255,0.10),
        0 0 14px rgba(255,59,59,0.10);
    }

    .header-logo-frame {
      border-radius: 18px;
      padding: 6px;
      background: #07080c;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .header-logo {
      height: 110px;
      width: auto;
      border-radius: 14px;
      display: block;
    }

    .title-line {
      display: flex;
      align-items: center;
      gap: 10px;
      row-gap: 8px;
      flex-wrap: wrap;
      white-space: normal;
      min-width: 0;
    }

    .main-title {
      font-size: clamp(26px, 4vw, 34px);
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      line-height: 1.05;
      text-shadow: 0 0 18px rgba(255,215,0,0.22);
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
      min-width: 0;
      max-width: 100%;
    }

    .side-label {
      font-size: 14px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      letter-spacing: 0.6px;
      text-transform: uppercase;
      white-space: normal;
      overflow-wrap: anywhere;
      max-width: 100%;
      flex-shrink: 0;
    }

    .subtitle {
      margin-top: 5px;
      font-size: 13px;
      opacity: 0.9;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .title-bar {
      margin-top: 8px;
      height: 7px;
      border-radius: 999px;
      background:
        linear-gradient(
          90deg,
          rgba(255,215,0,0.0) 0%,
          rgba(255,215,0,0.35) 18%,
          rgba(255,255,255,0.14) 50%,
          rgba(160,90,255,0.30) 82%,
          rgba(160,90,255,0.0) 100%
        );
      box-shadow: 0 0 18px rgba(255,215,0,0.14);
      opacity: 0.9;
    }

    .summary {
      padding: 18px 20px;
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      box-shadow: 0 10px 40px rgba(0,0,0,0.35);
      display: flex;
      flex-wrap: nowrap;
      gap: 14px;
      align-items: center;
      overflow-x: auto;
      overflow-y: hidden;
      position: relative;
    }

    .summary::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(55% 140% at 18% 0%, rgba(255,215,0,0.08), transparent 72%),
        radial-gradient(55% 140% at 82% 0%, rgba(160,90,255,0.08), transparent 72%);
      opacity: 0.9;
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      flex-wrap: nowrap;
      white-space: nowrap;
      flex: 0 0 auto;
      position: relative;
      z-index: 1;
    }

    .header-badge-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      padding: 9px 14px;
      border-radius: 999px;
      font-weight: 900;
      font-size: 12px;
      line-height: 1;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      background: rgba(0,0,0,0.20);
      color: white;
      flex-shrink: 0;
    }

    .header-badge-value-wrap {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: white;
      white-space: nowrap;
      flex-shrink: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .header-badge-main {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      font-weight: 900;
      font-size: 16px;
      line-height: 1;
      letter-spacing: 0.2px;
    }

    .header-badge-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 13px;
      line-height: 1;
      letter-spacing: 0.15px;
      font-variant-numeric: tabular-nums;
    }

    .separator {
      width: 2px;
      height: 32px;
      border-radius: 2px;
      background: linear-gradient(to bottom, transparent, rgba(210,215,225,0.9), transparent);
      box-shadow: 0 0 6px rgba(210,215,225,0.35);
      flex-shrink: 0;
      position: relative;
      z-index: 1;
    }

    .table-card {
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.22);
      overflow: hidden;
    }

    .table-head {
      padding: 14px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.10);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
    }

    .table-head-title {
      font-weight: 900;
      font-size: 16px;
      letter-spacing: 0.3px;
    }

    .table-head-pill {
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      opacity: 0.9;
      white-space: nowrap;
    }

    .table-wrap {
      width: max-content;
      min-width: 100%;
      overflow-x: auto;
      overflow-y: visible;
    }

    table {
      width: max-content;
      min-width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: rgba(10,12,18,0.96);
      backdrop-filter: blur(10px);
      padding: 10px 8px;
      text-align: center;
      font-size: 11px;
      opacity: 0.88;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    tbody td {
      padding: 8px 8px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      vertical-align: middle;
      font-size: 13px;
    }

    .col-pos { width: 52px; }
    .col-team { width: 250px; text-align: left; }
    .col-sprint-labels { width: 44px; }
    .col-round-detail { width: 170px; border-left: 1px solid rgba(255,255,255,0.08); }
    .col-round-total { width: 74px; border-left: 1px solid rgba(255,255,255,0.08); }
    .col-total { width: 96px; }

    .row-p1 {
      background: linear-gradient(90deg, rgba(255,215,0,0.12) 0%, rgba(255,215,0,0.05) 28%, rgba(255,255,255,0.02) 70%);
    }

    .row-p2 {
      background: linear-gradient(90deg, rgba(220,220,220,0.10) 0%, rgba(220,220,220,0.04) 28%, rgba(255,255,255,0.02) 70%);
    }

    .row-p3 {
      background: linear-gradient(90deg, rgba(205,127,50,0.12) 0%, rgba(205,127,50,0.05) 28%, rgba(255,255,255,0.02) 70%);
    }

    .row-even { background: rgba(255,255,255,0.02); }
    .row-odd { background: rgba(0,0,0,0.10); }

    .pos-cell {
      text-align: center;
    }

    .pos-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      height: 32px;
      padding: 0 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.22);
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      line-height: 1;
    }

    .team-cell {
      min-width: 0;
      text-align: left;
    }

    .team-wrap {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }

    .bmw-stripes {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
      transform: skewX(-16deg);
      transform-origin: center;
    }

    .stripe {
      width: 5px;
      height: 17px;
      border-radius: 2px;
      display: inline-block;
    }

    .stripe.blue {
      background: linear-gradient(180deg, #6fd3ff 0%, #3bb4e6 100%);
      box-shadow: 0 0 6px rgba(91,192,255,0.4);
    }

    .stripe.violet {
      background: linear-gradient(180deg, #8b5dff 0%, #6a3dff 100%);
      box-shadow: 0 0 6px rgba(124,77,255,0.4);
    }

    .stripe.red {
      background: linear-gradient(180deg, #ff6666 0%, #ff2f2f 100%);
      box-shadow: 0 0 6px rgba(255,59,59,0.4);
    }

    .team-name {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.02em;
      color: rgba(255,255,255,0.92);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
    }

    .sprint-labels-wrap {
      display: grid;
      gap: 6px;
      justify-items: center;
    }

    .sprint-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 18px;
      padding: 0 6px;
      border-radius: 999px;
      color: #ffffff;
      font-size: 10px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0.2px;
    }

    .sprint-pill-s1 {
      border: 1px solid rgba(0,207,255,0.5);
      background: rgba(0,207,255,0.22);
      box-shadow: 0 0 10px rgba(0,207,255,0.35);
    }

    .sprint-pill-s2 {
      border: 1px solid rgba(168,85,247,0.5);
      background: rgba(168,85,247,0.22);
      box-shadow: 0 0 10px rgba(168,85,247,0.35);
    }

    .round-detail-wrap {
      display: grid;
      gap: 6px;
    }

    .sprint-line {
      display: block;
    }

    .round-mini-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px;
      width: 100%;
      max-width: 132px;
      margin: 0 auto;
      font-size: 12px;
      font-weight: 900;
      line-height: 1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: rgba(255,255,255,0.96);
    }

    .round-mini-cell {
      text-align: center;
      position: relative;
    }

    .mini-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 40px;
      height: 18px;
      padding: 0 7px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0.2px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .mini-teal {
      background: rgba(64,224,208,0.92);
      border: 1px solid rgba(64,224,208,0.55);
      color: rgba(0,0,0,0.92);
    }

    .mini-pos {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-width: 36px;
  height: 20px;
  padding: 0;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  color: rgba(0,0,0,0.95);
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
}

    .mini-pos-p1 {
      background: linear-gradient(180deg, rgba(255,215,0,1), rgba(255,200,0,0.95));
      border: 1px solid rgba(255,215,0,0.55);
      box-shadow: 0 0 12px rgba(255,215,0,0.25);
    }

    .mini-pos-p2 {
      background: linear-gradient(180deg, rgba(220,220,220,0.96), rgba(185,185,185,0.96));
      border: 1px solid rgba(220,220,220,0.42);
      box-shadow: 0 0 10px rgba(220,220,220,0.18);
    }

    .mini-pos-p3 {
      background: linear-gradient(180deg, rgba(205,127,50,0.96), rgba(168,102,38,0.96));
      border: 1px solid rgba(205,127,50,0.45);
      box-shadow: 0 0 10px rgba(205,127,50,0.18);
    }

    .mini-text {
      font-size: 11px;
      font-weight: 900;
      line-height: 1;
      white-space: nowrap;
    }

    .mini-text-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-width: 36px;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-variant-numeric: tabular-nums;
  transform: translateY(2px);
}

    .mini-stars-pill {
  position: absolute;
  top: -5px;
  right: -8px;
  display: flex;
  gap: 1px;
  font-size: 9px;
  line-height: 1;
}

.mini-stars-pill.double {
  right: -12px;
}

.mini-stars-text {
  position: absolute;
  top: -5px;
  right: 1px;
  display: flex;
  gap: 1px;
  font-size: 9px;
  line-height: 1;
}

.mini-stars-text.double {
  right: -2px;
}

    .star-gold {
      color: #ffd700;
      text-shadow: 0 0 6px rgba(255,215,0,0.45);
    }

    .star-violet {
      color: #b67cff;
      text-shadow: 0 0 6px rgba(160,90,255,0.45);
    }

    .round-total-cell {
      padding: 6px 4px;
      text-align: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      border-left: 1px solid rgba(255,255,255,0.08);
      font-size: 14px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .round-total-on {
      color: #ffffff;
    }

    .round-total-off {
      color: rgba(255,255,255,0.42);
    }

    .total-cell {
      text-align: center;
      border-left: 1px solid rgba(255,255,255,0.12);
    }

    .team-total {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 54px;
      height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      font-weight: 900;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 16px;
      line-height: 1;
      letter-spacing: 0.2px;
    }

    .team-total-p1 {
      background: linear-gradient(180deg, rgba(255,215,0,1), rgba(255,200,0,0.95));
      border: 1px solid rgba(255,215,0,0.55);
      box-shadow: 0 0 14px rgba(255,215,0,0.28);
      color: rgba(0,0,0,0.95);
    }

    .team-total-p2 {
      background: linear-gradient(180deg, rgba(220,220,220,0.96), rgba(185,185,185,0.96));
      border: 1px solid rgba(220,220,220,0.42);
      box-shadow: 0 0 11px rgba(220,220,220,0.18);
      color: rgba(0,0,0,0.95);
    }

    .team-total-p3 {
      background: linear-gradient(180deg, rgba(205,127,50,0.96), rgba(168,102,38,0.96));
      border: 1px solid rgba(205,127,50,0.45);
      box-shadow: 0 0 11px rgba(205,127,50,0.18);
      color: rgba(0,0,0,0.95);
    }

    .team-total-normal {
      background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06));
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 0 8px rgba(255,255,255,0.05);
      color: #ffffff;
    }

    .header-round-title {
      display: grid;
      gap: 4px;
      justify-items: center;
    }

    .header-round-top {
      font-weight: 900;
      font-size: 12px;
      line-height: 1;
      letter-spacing: 0.25px;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .header-round-bottom {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 6px;
      width: 100%;
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.2px;
      line-height: 1;
    }

    .header-pro {
      color: #00cfff;
      text-shadow: 0 0 8px rgba(0,207,255,0.25);
    }

    .header-pama {
      color: #9b6bff;
      text-shadow: 0 0 8px rgba(155,107,255,0.25);
    }

    .header-ama {
      color: #ff4d4d;
      text-shadow: 0 0 8px rgba(255,77,77,0.25);
    }

    .header-dot {
      opacity: 0.35;
    }

    .footer-note {
      font-size: 12px;
      opacity: 0.72;
      padding: 0 4px;
    }

    @media (max-width: 980px) {

      .header {
        flex-wrap: wrap;
        align-items: flex-start;
      }

      .header-right {
        width: 100%;
        justify-content: flex-start;
      }

      .header-logo {
        height: 84px;
        max-width: 100%;
      }

      .page {
        padding: 14px;
      }
    }
  </style>
</head>
<body>
  <div id="bmwExportSplash">
  <div class="bmw-splash-card">
    ${
      splashImgSrc
        ? `<img src="${escapeHtml(splashImgSrc)}" alt="BMW M2 TEAM CUP" />`
        : `<div id="bmwExportSplashFallback">BMW M2 TEAM CUP</div>`
    }
  </div>

  <div class="bmw-splash-loader">
    <div class="bmw-splash-loading-text">Caricamento</div>
    <div class="bmw-splash-slashes">
      ${Array.from({ length: 24 })
        .map((_, i) => `<span style="animation-delay:${i * 0.07}s">///</span>`)
        .join("")}
    </div>
  </div>
</div>

<script>
  window.addEventListener("load", function () {
    setTimeout(function () {
      var splash = document.getElementById("bmwExportSplash");
      if (splash) splash.classList.add("splash-hide");
    }, 8000);
  });
</script>

  <div class="page">
    <div class="card header">
      <div class="header-left">
        <div class="title-line">
          <div class="main-title">${escapeHtml(texts.mainTitle)}</div>
          <span class="side-label">${escapeHtml(texts.sideLabel)}</span>
        </div>
        <div class="subtitle">${escapeHtml(texts.subtitle)}</div>
        <div class="title-bar"></div>
      </div>
      ${headerLogoHtml}
    </div>

    <div class="summary">
      ${summaryHtml}
    </div>

    <div class="table-card">
      <div class="table-head">
        <div class="table-head-title">Classifica Generale TEAM BMW CUP</div>
        <div class="table-head-pill">Team classificati: ${escapeHtml(String(championshipTeams.length))}</div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-pos">Pos</th>
              <th class="col-team" style="text-align:left;">Team</th>
              <th class="col-sprint-labels">&nbsp;</th>

              ${[1, 2, 3, 4]
                .map(
                  (round) => `
                <th class="col-round-detail">
                  <div class="header-round-title">
                    <div class="header-round-top">ROUND ${round}</div>
                    <div class="header-round-bottom">
                      <span class="header-pro">PRO</span>
                      <span class="header-dot">•</span>
                      <span class="header-pama">PAMA</span>
                      <span class="header-dot">•</span>
                      <span class="header-ama">AMA</span>
                    </div>
                  </div>
                </th>
              `
                )
                .join("")}

              <th class="col-round-total">R1</th>
              <th class="col-round-total">R2</th>
              <th class="col-round-total">R3</th>
              <th class="col-round-total">R4</th>
              <th class="col-total">TOT</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <div class="footer-note">
      Export HTML Classifica Generale TEAM BMW CUP • layout round completo
    </div>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = `bmw_m2_team_cup_classifica_generale_r${currentRound}.html`
    link.click()

    URL.revokeObjectURL(url)
  } catch (e: any) {
    setError("Errore export HTML classifica generale team: " + String(e?.message || e))
  } finally {
    setExportingGeneralTeamsHtml(false)
  }
}

function renderPenaltyHtmlForExport(row: DisplayRow, penalties: PenaltyMap) {
  const key = getPrtRowStableKey(row.sourcePosGara)
  const entries = penalties[key] || []
  const penaltyMain = getPenaltyMainDisplay(entries)
  const isDsqRow = (row.tempoTotaleGara || "").trim().toUpperCase() === "DSQ"

  if (isDsqRow || penaltyMain.kind === "dsq") {
    return `<span class="pill dsq">DSQ</span>`
  }

  if (entries.length === 0) return `<span>-</span>`

  if (penaltyMain.kind === "ammonition") {
    return `<span class="penalty-total penalty-ammonition">00:00.000</span>`
  }

  if (penaltyMain.kind === "time") {
    return `<span class="penalty-total">${escapeHtml(penaltyMain.text)}</span>`
  }

  return `<span>-</span>`
}

function renderPointsHtmlForExport(row: DisplayRow, bestRaceLap: string) {
  const rawTempo = tempoLikeGt7(row).trim().toUpperCase()
  const isZero = rawTempo === "BOX" || rawTempo === "DNF" || rawTempo === "DNFV" || rawTempo === "DNP" || rawTempo === "DSQ"

  const isPole = (row.pole || "").trim().toUpperCase() === "POLE"
  const bestLapTime = (bestRaceLap.split("  ").pop() || "").trim()
  const isBestLap = !!bestLapTime && (row.migliorGiroGara || "").trim() === bestLapTime

  const bonus = (isPole ? 1 : 0) + (isBestLap ? 1 : 0)
  const points = isZero ? bonus : getPointsForPrtRow(row, bestRaceLap)

  const title = isZero
    ? "Punti gara: 0"
    : isPole && isBestLap
      ? "Bonus: POLE + BEST LAP"
      : isPole
        ? "Bonus: POLE"
        : isBestLap
          ? "Bonus: BEST LAP"
          : "Punti gara"

    const starsClass =
    isPole && isBestLap ? "points-stars double" : "points-stars"

  const starsHtml = (isPole || isBestLap)
    ? `
      <span class="${starsClass}">
        ${isPole ? `<span class="star-gold">★</span>` : ""}
        ${isBestLap ? `<span class="star-violet">★</span>` : ""}
      </span>
    `
    : ""

  if (row.posGara === 1) {
    return `
      <span class="points-pill points-p1" title="${escapeHtml(title)}">
        <span>${points}</span>
        ${starsHtml}
      </span>
    `
  }

  if (row.posGara === 2) {
    return `
      <span class="points-pill points-p2" title="${escapeHtml(title)}">
        <span>${points}</span>
        ${starsHtml}
      </span>
    `
  }

  if (row.posGara === 3) {
    return `
      <span class="points-pill points-p3" title="${escapeHtml(title)}">
        <span>${points}</span>
        ${starsHtml}
      </span>
    `
  }

  return `
    <span class="points-pill normal" title="${escapeHtml(title)}">
      <span>${points}</span>
      ${starsHtml}
    </span>
  `
}

function renderMiniRoundDetailHtml(
  value:
    | string
    | {
        text: string
        pole?: boolean
        bestLap?: boolean
      }
) {
  const detail =
    typeof value === "string"
      ? { text: value, pole: false, bestLap: false }
      : {
          text: String(value?.text || "").trim(),
          pole: !!value?.pole,
          bestLap: !!value?.bestLap,
        }

  const upper = String(detail.text || "").trim().toUpperCase()

  if (upper === "DNF-I") {
    return `<span class="mini-pill mini-teal">DNF-I</span>`
  }

  if (upper === "DNF-V") {
    return `<span class="mini-pill mini-teal">DNF-V</span>`
  }

  if (upper === "DNP") {
    return `<span class="mini-pill mini-teal">DNP</span>`
  }

  if (upper === "-") {
    return `<span class="mini-text">-</span>`
  }

  const isP1 = upper === "1°"
  const isP2 = upper === "2°"
  const isP3 = upper === "3°"

  const pillStarsClass =
    detail.pole && detail.bestLap
      ? "mini-stars-pill double"
      : "mini-stars-pill"

  const textStarsClass =
    detail.pole && detail.bestLap
      ? "mini-stars-text double"
      : "mini-stars-text"

  const pillStarsHtml =
    detail.pole || detail.bestLap
      ? `
        <span class="${pillStarsClass}">
          ${detail.pole ? `<span class="star-gold">★</span>` : ""}
          ${detail.bestLap ? `<span class="star-violet">★</span>` : ""}
        </span>
      `
      : ""

  const textStarsHtml =
    detail.pole || detail.bestLap
      ? `
        <span class="${textStarsClass}">
          ${detail.pole ? `<span class="star-gold">★</span>` : ""}
          ${detail.bestLap ? `<span class="star-violet">★</span>` : ""}
        </span>
      `
      : ""

  if (isP1) {
    return `
      <span class="mini-pos mini-pos-p1">
        <span>${escapeHtml(detail.text)}</span>
        ${pillStarsHtml}
      </span>
    `
  }

  if (isP2) {
    return `
      <span class="mini-pos mini-pos-p2">
        <span>${escapeHtml(detail.text)}</span>
        ${pillStarsHtml}
      </span>
    `
  }

  if (isP3) {
    return `
      <span class="mini-pos mini-pos-p3">
        <span>${escapeHtml(detail.text)}</span>
        ${pillStarsHtml}
      </span>
    `
  }

  return `
    <span class="mini-text-wrap">
      <span>${escapeHtml(detail.text || "-")}</span>
      ${textStarsHtml}
    </span>
  `
}

function renderTeamRoundDetailHtml(
  teamName: string,
  round: number,
  sprint: "sprint1" | "sprint2"
) {
  const detail = getTeamRoundDetail(teamName, round, sprint)

  return `
    <div
      style="
        display:grid;
        grid-template-columns:repeat(3, minmax(0, 1fr));
        gap:4px;
        width:100%;
        max-width:132px;
        margin:0 auto;
        font-size:12px;
        font-weight:900;
        line-height:1;
        font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color:rgba(255,255,255,0.96);
      "
    >
      <div style="text-align:center;">${renderMiniRoundDetailHtml(detail.pro)}</div>
      <div style="text-align:center;">${renderMiniRoundDetailHtml(detail.proAma)}</div>
      <div style="text-align:center;">${renderMiniRoundDetailHtml(detail.ama)}</div>
    </div>
  `
}

  function openExportModal() {
  setExportTarget("png")
  setExportTextsDraft(exportTexts)
  setShowExportModal(true)
}

  async function confirmExportPng() {
  const nextTexts = {
    mainTitle: (exportTextsDraft.mainTitle || "BMW M2 TEAM CUP").trim(),
    sideLabel: (exportTextsDraft.sideLabel || "Official Timing System").trim(),
    subtitle: (exportTextsDraft.subtitle || "Powered by Albixximo").trim(),
  }

  setExportTexts(nextTexts)
  setShowExportModal(false)

  await new Promise((resolve) => setTimeout(resolve, 80))

  if (exportTarget === "png") {
    await performExportTablePng()
    return
  }

  if (exportTarget === "html") {
    await downloadExtendedHtmlExport(nextTexts)
    return
  }

  if (exportTarget === "html-teams") {
    await downloadGeneralTeamsHtmlExport(nextTexts)
    return
  }
}

  async function run() {
    setSprint2Ready(false)
    setShowSprint2UploadConfirm(false)
    setShowSprintResetConfirm(false)
    setLoading(true)
    setError("")
    setCsv("")
    setRows([])
    setUnionMeta({ gara: "", lobby: "", lega: "" })
    setManualGaraOverride("")
    setManualLegaOverride("")
    setPenalties({})
    setLapOverrides({})
    setDnfOverrides({})
    setManualPilotOverrides({})
    setManualAutoOverrides({})
    setManualDistaccoOverrides({})
    setManualPilotDraft({})
setManualDistaccoDraft({})
setShowPilotModal(false)
setShowDistaccoModal(false)
setIsReopenedSavedSprint(false)
    setReopenedSprintKey(null)

    try {
      const fd = new FormData()
      for (const f of files) fd.append("files", f)

      const res = await fetch("/api/albixximo", { method: "POST", body: fd })
      const data = await res.json()

      if (!res.ok) {
        setError(JSON.stringify(data, null, 2))
      } else {
        setCsv(data.csv || "")
        setRows(Array.isArray(data.rows) ? data.rows : [])
        setUnionMeta(
          data.unionMeta && typeof data.unionMeta === "object"
            ? {
                gara: data.unionMeta.gara || "",
                lobby: data.unionMeta.lobby || "",
                lega: data.unionMeta.lega || "",
              }
            : { gara: "", lobby: "", lega: "" }
        )
      }
    } catch (e: any) {
      setError(String(e?.message || e))
    } finally {
      setLoading(false)
    }
  }

  function handleLogin() {
  if (inputPassword === BMW_APP_PASSWORD) {
    setAuthorized(true)
    sessionStorage.setItem(BMW_AUTH_STORAGE_KEY, "true")
    setLoginError("")
    return
  }

  setLoginError("Password errata")
}

function handleLogout() {
  sessionStorage.removeItem(BMW_AUTH_STORAGE_KEY)
  setAuthorized(false)
  setInputPassword("")
  setLoginError("")
}
  
  function resetAll() {
    window.location.reload()
  }

  function exportPortableBackup() {
  try {
    const payload: BmwPortableBackup = {
      version: BMW_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      app: "bmw-m2-team-cup",
      data: {
        // BMW championship
        teams,
        currentRound,
        roundSnapshots,
        savedSprintPreviews,
        currentSprint,

        // export texts
        exportTexts,

        // live extractor session
        csv,
        rows,
        unionMeta,
        filesMeta: files.map((f) => ({
          name: f.name,
          size: f.size,
          type: f.type,
          lastModified: f.lastModified,
        })),

        // ui state
        prtMode,
        unionMode,
        showTable,
        exportMetaInPng,
        manualGaraOverride,
        manualLegaOverride,

        // penalties + manual corrections
        penalties,
        lapOverrides,
        dnfOverrides,
        manualPilotOverrides,
        manualAutoOverrides,
        manualDistaccoOverrides,
      },
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    })

    const url = URL.createObjectURL(blob)

    const fileName = `bmw-m2-team-cup_backup_totale_r${currentRound}_${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.json`

    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.click()

    URL.revokeObjectURL(url)
  } catch (e: any) {
    setError(`Errore export backup: ${String(e?.message || e)}`)
  }
}

function importPortableBackupFromFile(file: File) {
  const reader = new FileReader()

  reader.onload = () => {
    try {
      const text = String(reader.result || "")
      const parsed = JSON.parse(text) as BmwPortableBackup

      if (!parsed || typeof parsed !== "object") {
        throw new Error("File non valido.")
      }

      if (parsed.app !== "bmw-m2-team-cup") {
        throw new Error("Questo file non appartiene al progetto BMW M2 TEAM CUP.")
      }

      if (!parsed.data || typeof parsed.data !== "object") {
        throw new Error("Struttura backup non valida.")
      }

      const nextTeams = Array.isArray(parsed.data.teams) ? parsed.data.teams : []
      const nextCurrentRound =
        [1, 2, 3, 4].includes(parsed.data.currentRound) ? parsed.data.currentRound : 1

      const nextRoundSnapshots =
        parsed.data.roundSnapshots && typeof parsed.data.roundSnapshots === "object"
          ? parsed.data.roundSnapshots
          : {}

      const nextSavedSprintPreviews =
        parsed.data.savedSprintPreviews && typeof parsed.data.savedSprintPreviews === "object"
          ? parsed.data.savedSprintPreviews
          : { sprint1: null, sprint2: null }

      const nextCurrentSprint = parsed.data.currentSprint === 2 ? 2 : 1

      const nextExportTexts =
        parsed.data.exportTexts && typeof parsed.data.exportTexts === "object"
          ? {
              mainTitle: parsed.data.exportTexts.mainTitle || "BMW M2 TEAM CUP",
              sideLabel: parsed.data.exportTexts.sideLabel || "Official Timing System",
              subtitle: parsed.data.exportTexts.subtitle || "Powered by Albixximo",
            }
          : {
              mainTitle: "BMW M2 TEAM CUP",
              sideLabel: "Official Timing System",
              subtitle: "Powered by Albixximo",
            }

      const nextCsv = typeof parsed.data.csv === "string" ? parsed.data.csv : ""
      const nextRows = Array.isArray(parsed.data.rows) ? parsed.data.rows : []
      const nextUnionMeta =
        parsed.data.unionMeta && typeof parsed.data.unionMeta === "object"
          ? {
              gara: parsed.data.unionMeta.gara || "",
              lobby: parsed.data.unionMeta.lobby || "",
              lega: parsed.data.unionMeta.lega || "",
            }
          : { gara: "", lobby: "", lega: "" }

      const nextPrtMode =
        typeof parsed.data.prtMode === "boolean" ? parsed.data.prtMode : true

      const nextUnionMode =
        typeof parsed.data.unionMode === "boolean" ? parsed.data.unionMode : false

      const nextShowTable =
        typeof parsed.data.showTable === "boolean" ? parsed.data.showTable : true

      const nextExportMetaInPng =
        typeof parsed.data.exportMetaInPng === "boolean"
          ? parsed.data.exportMetaInPng
          : false

      const nextManualGaraOverride =
        typeof parsed.data.manualGaraOverride === "string"
          ? parsed.data.manualGaraOverride
          : ""

      const nextManualLegaOverride =
        typeof parsed.data.manualLegaOverride === "string"
          ? parsed.data.manualLegaOverride
          : ""

      const nextPenalties =
        parsed.data.penalties && typeof parsed.data.penalties === "object"
          ? parsed.data.penalties
          : {}

      const nextLapOverrides =
        parsed.data.lapOverrides && typeof parsed.data.lapOverrides === "object"
          ? parsed.data.lapOverrides
          : {}

      const nextDnfOverrides =
        parsed.data.dnfOverrides && typeof parsed.data.dnfOverrides === "object"
          ? parsed.data.dnfOverrides
          : {}

      const nextManualPilotOverrides =
        parsed.data.manualPilotOverrides &&
        typeof parsed.data.manualPilotOverrides === "object"
          ? parsed.data.manualPilotOverrides
          : {}

      const nextManualAutoOverrides =
        parsed.data.manualAutoOverrides &&
        typeof parsed.data.manualAutoOverrides === "object"
          ? parsed.data.manualAutoOverrides
          : {}

      const nextManualDistaccoOverrides =
        parsed.data.manualDistaccoOverrides &&
        typeof parsed.data.manualDistaccoOverrides === "object"
          ? parsed.data.manualDistaccoOverrides
          : {}

      setTeams(nextTeams)
      setCurrentRound(nextCurrentRound)
      setRoundSnapshots(nextRoundSnapshots)
      setSavedSprintPreviews(nextSavedSprintPreviews)
      setCurrentSprint(nextCurrentSprint)

      setExportTexts(nextExportTexts)
      setExportTextsDraft(nextExportTexts)

      setCsv(nextCsv)
      setRows(nextRows)
      setUnionMeta(nextUnionMeta)

      setPrtMode(nextPrtMode)
      setUnionMode(nextUnionMode)
      setShowTable(nextShowTable)
      setExportMetaInPng(nextExportMetaInPng)
      setManualGaraOverride(nextManualGaraOverride)
      setManualLegaOverride(nextManualLegaOverride)

      setPenalties(nextPenalties)
      setLapOverrides(nextLapOverrides)
      setDnfOverrides(nextDnfOverrides)
      setManualPilotOverrides(nextManualPilotOverrides)
      setManualAutoOverrides(nextManualAutoOverrides)
      setManualDistaccoOverrides(nextManualDistaccoOverrides)

      setFiles([])
      setManualPilotDraft({})
      setManualDistaccoDraft({})
      setShowPilotModal(false)
      setShowDistaccoModal(false)

      setError("")
      setShowSprintInfo(false)
      setShowSprint2UploadConfirm(false)
      setShowSprint2DoneInfo(false)
      setShowSprintResetConfirm(false)
      setSprint2Ready(false)

      localStorage.setItem(
        BMW_EVENT_STORAGE_KEY,
        JSON.stringify({
          teams: nextTeams,
          currentRound: nextCurrentRound,
          roundSnapshots: nextRoundSnapshots,
        })
      )
    } catch (e: any) {
      setError(`Errore import backup: ${String(e?.message || e)}`)
    }
  }

  reader.onerror = () => {
    setError("Errore lettura file backup.")
  }

  reader.readAsText(file)
}

function handleBackupImportChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return

  importPortableBackupFromFile(file)

  e.target.value = ""
}

  function saveCurrentSprint() {
  if (!currentBmwSprintSnapshot) return

  const sprintKey: BmwSprintKey = currentSprint === 1 ? "sprint1" : "sprint2"

  const wasAlreadySaved =
    currentSprint === 1
      ? !!savedSprintPreviews.sprint1
      : !!savedSprintPreviews.sprint2

  const nextSavedSprintPreviews = {
    ...savedSprintPreviews,
    [sprintKey]: currentBmwSprintSnapshot,
  }

  setSavedSprintPreviews(nextSavedSprintPreviews)

  const currentLeagueName = getCurrentBmwLeagueName()
  const roundKey = getRoundKey(currentRound)

  if (currentLeagueName && roundSnapshots[roundKey]?.leagues?.[currentLeagueName]) {
    setRoundSnapshots((prev) => {
      const currentRoundSnapshotLocal = prev[roundKey]
      const currentLeagueSnapshot = currentRoundSnapshotLocal?.leagues?.[currentLeagueName]

      if (!currentRoundSnapshotLocal || !currentLeagueSnapshot) return prev

      const updatedSprint1 =
        sprintKey === "sprint1"
          ? currentBmwSprintSnapshot
          : currentLeagueSnapshot.sprint1

      const updatedSprint2 =
        sprintKey === "sprint2"
          ? currentBmwSprintSnapshot
          : currentLeagueSnapshot.sprint2

      const updatedLeagueSnapshot: BmwLeagueSnapshot = {
        ...currentLeagueSnapshot,
        savedAt: new Date().toISOString(),
        status: getBmwLeagueSnapshotStatus(updatedSprint1, updatedSprint2),
        sprint1: updatedSprint1,
        sprint2: updatedSprint2,
        drivers: buildBmwLeagueDriversFromSprints(updatedSprint1, updatedSprint2),
      }

      const nextLeagues: Partial<Record<BmwLeagueName, BmwLeagueSnapshot>> = {
        ...(currentRoundSnapshotLocal.leagues || {}),
        [currentLeagueName]: updatedLeagueSnapshot,
      }

      const nextRoundTeamResults = buildBmwRoundTeamResultsFromLeagues(nextLeagues, teams)

      return {
        ...prev,
        [roundKey]: {
          ...currentRoundSnapshotLocal,
          updatedAt: new Date().toISOString(),
          leagues: nextLeagues,
          roundTeamResults: nextRoundTeamResults,
        },
      }
    })
  }

  setLastSavedSprintNumber(currentSprint)
  setLastSprintSaveMode(wasAlreadySaved ? "overwrite" : "save")
  setShowSprintSaveSuccessModal(true)

  if (isReopenedSavedSprint) {
    setIsReopenedSavedSprint(false)
    setReopenedSprintKey(null)
  }
}

function resetSavedSprints() {
  setSavedSprintPreviews({
    sprint1: null,
    sprint2: null,
  })
  setCurrentSprint(1)
  setSprint2Ready(false)
  setShowSprintInfo(false)
  setShowSprint2UploadConfirm(false)
  setShowSprint2DoneInfo(false)
  setShowSprintResetConfirm(true)
  setIsReopenedSavedSprint(false)
setReopenedSprintKey(null)
}

function openReopenLeagueModal(league: BmwLeagueName) {
  setSelectedLeagueToReopen(league)
  setShowReopenLeagueModal(true)
}

function closeReopenLeagueModal() {
  setSelectedLeagueToReopen(null)
  setShowReopenLeagueModal(false)
}

function openResetLeagueModal(league: BmwLeagueName) {
  setSelectedLeagueToReset(league)
  setShowResetLeagueModal(true)
}

function closeResetLeagueModal() {
  setSelectedLeagueToReset(null)
  setShowResetLeagueModal(false)
}

function resetSpecificLeagueInRound(league: BmwLeagueName) {
  const roundKey = getRoundKey(currentRound)

  setRoundSnapshots((prev) => {
    const currentSnapshot = prev[roundKey]
    if (!currentSnapshot) return prev

    const nextLeagues: Partial<Record<BmwLeagueName, BmwLeagueSnapshot>> = {
      ...(currentSnapshot.leagues || {}),
    }

    delete nextLeagues[league]

    const hasAnyLeagueLeft = Object.keys(nextLeagues).length > 0

    const nextSnapshots: Partial<Record<RoundKey, BmwRoundSnapshot>> = {
      ...prev,
    }

    if (!hasAnyLeagueLeft) {
      delete nextSnapshots[roundKey]
    } else {
      const nextRoundTeamResults = buildBmwRoundTeamResultsFromLeagues(nextLeagues, teams)

      nextSnapshots[roundKey] = {
        ...currentSnapshot,
        updatedAt: new Date().toISOString(),
        leagues: nextLeagues,
        roundTeamResults: nextRoundTeamResults,
      }
    }

    const nextTeams = buildTeamsFromRoundSnapshots(teams, nextSnapshots)
    setTeams(nextTeams)

    return nextSnapshots
  })

  setLastResetLeagueName(league)

  if (selectedLeagueToReset === league) {
    setSelectedLeagueToReset(null)
  }

  setShowResetLeagueModal(false)
  setShowResetLeagueSuccessModal(true)
}

function resetAllLeaguesInCurrentRound() {
  const roundKey = getRoundKey(currentRound)

  setRoundSnapshots((prev) => {
    const currentSnapshot = prev[roundKey]
    if (!currentSnapshot) return prev

    const nextSnapshots: Partial<Record<RoundKey, BmwRoundSnapshot>> = {
      ...prev,
    }

    delete nextSnapshots[roundKey]

    const nextTeams = buildTeamsFromRoundSnapshots(teams, nextSnapshots)
    setTeams(nextTeams)

    return nextSnapshots
  })

  setShowResetAllLeaguesModal(false)
  setShowResetAllLeaguesSuccessModal(true)
}

function reopenSavedLeagueSprint(
  league: BmwLeagueName,
  sprint: BmwSprintKey
) {
  const leagueSnapshot = currentRoundSnapshot?.leagues?.[league]
  if (!leagueSnapshot) {
    setError(`Nessun salvataggio trovato per la lega ${league}.`)
    return
  }

  const sprintSnapshot =
    sprint === "sprint1" ? leagueSnapshot.sprint1 : leagueSnapshot.sprint2

  if (!sprintSnapshot) {
    setError(`Nessun salvataggio trovato per ${league} - ${sprint.toUpperCase()}.`)
    return
  }

  setError("")

  const restoredGara =
    String(sprintSnapshot.savedGara || "").trim() ||
    String(sprintSnapshot.unionMeta?.gara || "").trim()

  const restoredLega =
    String(sprintSnapshot.savedLega || "").trim().toUpperCase() ||
    String(sprintSnapshot.unionMeta?.lega || "").trim().toUpperCase() ||
    league

  const restoredLobby = String(sprintSnapshot.unionMeta?.lobby || "").trim()

  setCsv(typeof sprintSnapshot.finalCsv === "string" ? sprintSnapshot.finalCsv : "")
setRows(
  Array.isArray(sprintSnapshot.finalRows)
    ? (sprintSnapshot.finalRows as unknown as ExtractRow[])
    : []
)

  setUnionMeta({
    gara: restoredGara,
    lobby: restoredLobby,
    lega: restoredLega,
  })

  setManualGaraOverride(restoredGara && restoredGara !== "-" ? restoredGara : "")
  setManualLegaOverride(restoredLega || league)

  setCurrentSprint(sprint === "sprint1" ? 1 : 2)
  setIsReopenedSavedSprint(true)
setReopenedSprintKey(sprint)

  setPenalties(sprintSnapshot.penalties || {})
  setLapOverrides(sprintSnapshot.lapOverrides || {})
  setDnfOverrides(sprintSnapshot.dnfOverrides || {})
  setManualPilotOverrides(sprintSnapshot.manualPilotOverrides || {})
  setManualAutoOverrides(sprintSnapshot.manualAutoOverrides || {})
  setManualDistaccoOverrides(sprintSnapshot.manualDistaccoOverrides || {})

  setManualPilotDraft({})
  setManualDistaccoDraft({})
  setPilotModalRows([])

  setShowPilotModal(false)
  setShowDistaccoModal(false)
  setShowDgTable(false)
  setShowMissingPilotWarning(false)

  setShowSprintInfo(false)
  setShowSprint2DoneInfo(false)
  setShowSprint2UploadConfirm(false)
  setShowSprintResetConfirm(false)
  setSprint2Ready(false)
  setPendingSprint2Upload(false)

    setShowReopenLeagueModal(false)
  setSelectedLeagueToReopen(null)

  setSavedSprintPreviews({
    sprint1: leagueSnapshot.sprint1 || null,
    sprint2: leagueSnapshot.sprint2 || null,
  })

  setIsReopenedSavedSprint(true)
  setReopenedSprintKey(sprint)

  requestAnimationFrame(() => {
    topPageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  })
}
  
function openConfirmSaveLeagueModal() {
  const leagueName = getCurrentBmwLeagueName()

  if (!leagueName) {
    setError("Lega BMW non valida. Deve essere PRO, PRO-AMA oppure AMA.")
    return
  }

  if (!savedSprintPreviews.sprint1 || !savedSprintPreviews.sprint2) {
    setError("Devi prima salvare Sprint 1 e Sprint 2 prima di salvare la lega nel round.")
    return
  }

  const roundKey = getRoundKey(currentRound)
  const alreadyExists = !!roundSnapshots[roundKey]?.leagues?.[leagueName]

  setPendingSaveLeagueMode(alreadyExists ? "overwrite" : "save")
  setShowConfirmSaveLeagueModal(true)
}  

function openConfirmFinalizeRoundModal() {
  setFinalizeRoundMode(isCurrentRoundAlreadySaved ? "overwrite" : "save")
  setShowConfirmFinalizeRoundModal(true)
}

function saveOrUpdateCurrentRound() {
  const roundKey = getRoundKey(currentRound)
  const leagueName = getCurrentBmwLeagueName()

  if (!leagueName) {
    setError("Lega BMW non valida. Deve essere PRO, PRO-AMA oppure AMA.")
    return
  }

  if (!savedSprintPreviews.sprint1 || !savedSprintPreviews.sprint2) {
    setError("Devi prima salvare Sprint 1 e Sprint 2 prima di salvare la lega nel round.")
    return
  }

  setShowConfirmSaveLeagueModal(false)

  const alreadyExists = !!roundSnapshots[roundKey]?.leagues?.[leagueName]

  setRoundSnapshots((prev) => {
    const now = new Date().toISOString()
    const existingRound = prev[roundKey]

    const nextLeagueSnapshot: BmwLeagueSnapshot = {
      league: leagueName,
      round: roundKey,
      savedAt: now,
      status: getBmwLeagueSnapshotStatus(
        savedSprintPreviews.sprint1,
        savedSprintPreviews.sprint2
      ),
      sprint1: savedSprintPreviews.sprint1,
      sprint2: savedSprintPreviews.sprint2,
      drivers: buildBmwLeagueDriversFromSprints(
        savedSprintPreviews.sprint1,
        savedSprintPreviews.sprint2
      ),
    }

    const nextLeagues: Partial<Record<BmwLeagueName, BmwLeagueSnapshot>> = {
      ...(existingRound?.leagues || {}),
      [leagueName]: nextLeagueSnapshot,
    }

    const nextRoundTeamResults = buildBmwRoundTeamResultsFromLeagues(nextLeagues, teams)

    return {
      ...prev,
      [roundKey]: {
        round: roundKey,
        savedAt: existingRound?.savedAt || now,
        updatedAt: now,
        status: "open",
        leagues: nextLeagues,
        roundTeamResults: nextRoundTeamResults,
        generalTeamResults: existingRound?.generalTeamResults || [],
      },
    }
  })

  setLastSavedLeagueName(leagueName)
  setLastSaveLeagueMode(alreadyExists ? "overwrite" : "save")
  setShowSaveLeagueSuccessModal(true)
}

function finalizeCurrentRound() {
  const roundKey = getRoundKey(currentRound)

  setRoundSnapshots((prev) => {
    const currentSnapshot = prev[roundKey]

    if (!currentSnapshot) {
      setError("Nessun dato presente per il round corrente.")
      return prev
    }

    if (!isRoundSnapshotReady(currentSnapshot)) {
      setError("Il round non è ancora completo. Servono PRO, PRO-AMA e AMA con entrambe le sprint salvate.")
      return prev
    }

    const now = new Date().toISOString()

    const draftSnapshots: Partial<Record<RoundKey, BmwRoundSnapshot>> = {
      ...prev,
      [roundKey]: {
        ...currentSnapshot,
        updatedAt: now,
        status: "consolidated",
      },
    }

    const nextGeneralTeamResults = buildBmwGeneralTeamResultsFromRoundSnapshots(
      draftSnapshots,
      teams
    )

    draftSnapshots[roundKey] = {
      ...draftSnapshots[roundKey]!,
      generalTeamResults: nextGeneralTeamResults,
    }

    const nextTeams = buildTeamsFromRoundSnapshots(teams, draftSnapshots)
    setTeams(nextTeams)

    return draftSnapshots
  })
}

function resetCurrentLeagueInRound() {
  const roundKey = getRoundKey(currentRound)
  const leagueName = getCurrentBmwLeagueName()

  if (!leagueName) {
    setError("Lega BMW non valida. Deve essere PRO, PRO-AMA oppure AMA.")
    return
  }

  const currentSnapshot = roundSnapshots[roundKey]
  if (!currentSnapshot) {
    window.location.reload()
    return
  }

  const nextLeagues: Partial<Record<BmwLeagueName, BmwLeagueSnapshot>> = {
    ...(currentSnapshot.leagues || {}),
  }

  delete nextLeagues[leagueName]

  const hasAnyLeagueLeft = Object.keys(nextLeagues).length > 0

  const nextSnapshots: Partial<Record<RoundKey, BmwRoundSnapshot>> = {
    ...roundSnapshots,
  }

  if (!hasAnyLeagueLeft) {
    delete nextSnapshots[roundKey]
  } else {
    const nextRoundTeamResults = buildBmwRoundTeamResultsFromLeagues(nextLeagues, teams)

    nextSnapshots[roundKey] = {
      ...currentSnapshot,
      updatedAt: new Date().toISOString(),
      leagues: nextLeagues,
      roundTeamResults: nextRoundTeamResults,
    }
  }

  const nextTeams = buildTeamsFromRoundSnapshots(teams, nextSnapshots)

  setRoundSnapshots(nextSnapshots)
  setTeams(nextTeams)

  localStorage.setItem(
    BMW_EVENT_STORAGE_KEY,
    JSON.stringify({
      teams: nextTeams,
      currentRound,
      roundSnapshots: nextSnapshots,
    })
  )

  window.location.reload()
}

function resetEntireCurrentRound() {
  const roundKey = getRoundKey(currentRound)

  setRoundSnapshots((prev) => {
    const nextSnapshots = { ...prev }
    delete nextSnapshots[roundKey]

    const nextTeams = buildTeamsFromRoundSnapshots(teams, nextSnapshots)
    setTeams(nextTeams)

    return nextSnapshots
  })
}

  function addPenaltyEntry(sourcePosGara: number) {
    const key = getPrtRowStableKey(sourcePosGara)
    setPenalties((prev) => {
      const next = { ...prev }
      next[key] = [...(next[key] || []), createPenaltyEntry()]
      return next
    })
  }

  function updatePenaltyEntry(sourcePosGara: number, entryId: string, patch: Partial<PenaltyEntry>) {
    const key = getPrtRowStableKey(sourcePosGara)
    setPenalties((prev) => {
      const next = { ...prev }
      next[key] = (next[key] || []).map((entry) =>
        entry.id === entryId ? { ...entry, ...patch } : entry
      )
      return next
    })
  }

  function removePenaltyEntry(sourcePosGara: number, entryId: string) {
    const key = getPrtRowStableKey(sourcePosGara)
    setPenalties((prev) => {
      const next = { ...prev }
      const filtered = (next[key] || []).filter((entry) => entry.id !== entryId)
      if (filtered.length === 0) {
        delete next[key]
      } else {
        next[key] = filtered
      }
      return next
    })
  }

  function setLapOverrideValue(sourcePosGara: number, value: string) {
    const key = getPrtRowStableKey(sourcePosGara)
    setLapOverrides((prev) => {
      const next = { ...prev }
      const clean = value.trim()
      if (!clean) {
        delete next[key]
      } else {
        next[key] = value
      }
      return next
    })
  }

  function setDnfOverrideValue(sourcePosGara: number, value: string) {
  const key = getPrtRowStableKey(sourcePosGara)
  setDnfOverrides((prev) => {
    const next = { ...prev }

    if (value === "DNF-V") {
      next[key] = "DNF-V"
    } else {
      next[key] = "DNF-I"
    }

    return next
  })
}

  function openPilotCorrectionModal() {
  const snapshotRows = displayRows.map((row) => ({ ...row }))

  if (hasMissingPilotRows(snapshotRows)) {
    setShowMissingPilotWarning(true)
    return
  }

  const nextDraft: Record<number, string> = {}
  for (const row of snapshotRows) {
    nextDraft[row.sourcePosGara] = String(row.pilota ?? "").trim()
  }

  setPilotModalRows(snapshotRows)
  setManualPilotDraft(nextDraft)
  setShowPilotModal(true)
}

function continuePilotCorrectionModalAnyway() {
  const snapshotRows = displayRows.map((row) => ({ ...row }))

  const nextDraft: Record<number, string> = {}
  for (const row of snapshotRows) {
    nextDraft[row.sourcePosGara] = String(row.pilota ?? "").trim()
  }

  setPilotModalRows(snapshotRows)
  setManualPilotDraft(nextDraft)
  setShowMissingPilotWarning(false)
  setShowPilotModal(true)
}

function applyPilotCorrections() {
  const nextPilotOverrides: Record<number, string> = {}
  const nextAutoOverrides: Record<number, string> = {}

  for (const modalRow of pilotModalRows) {
    const originalPreviewRow = previewRows.find(
      (candidate) => candidate.sourcePosGara === modalRow.sourcePosGara
    )

    if (!originalPreviewRow) continue

    const originalPilotName = String(originalPreviewRow.pilota ?? "").trim()
    const finalPilotName = String(
      manualPilotDraft[modalRow.sourcePosGara] ?? modalRow.pilota ?? ""
    ).trim()

    if (finalPilotName && finalPilotName !== originalPilotName) {
      nextPilotOverrides[modalRow.sourcePosGara] = finalPilotName
    }

    const originalAuto = String(originalPreviewRow.auto ?? "").trim()

    const matchedPreviewRow = previewRows.find(
      (candidate) =>
        normalizePilot(candidate.pilota) === normalizePilot(finalPilotName)
    )

    if (matchedPreviewRow) {
      const matchedAuto = String(matchedPreviewRow.auto ?? "").trim()

      if (matchedAuto && matchedAuto !== originalAuto) {
        nextAutoOverrides[modalRow.sourcePosGara] = matchedAuto
      }
    } else {
      const currentDisplayedAuto = String(modalRow.auto ?? "").trim()

      if (currentDisplayedAuto && currentDisplayedAuto !== originalAuto) {
        nextAutoOverrides[modalRow.sourcePosGara] = currentDisplayedAuto
      }
    }
  }

  setManualPilotOverrides(nextPilotOverrides)
  setManualAutoOverrides(nextAutoOverrides)
  setManualPilotDraft({})
  setPilotModalRows([])
  setShowPilotModal(false)
}

function resetPilotCorrections() {
  setManualPilotOverrides({})
  setManualPilotDraft({})
  setManualAutoOverrides({})
  setPilotModalRows([])
  setShowPilotModal(false)
}

function openDistaccoCorrectionModal() {
  const nextDraft: Record<number, string> = {}
  for (const row of displayRows) {
    nextDraft[row.sourcePosGara] = String(row.distaccoDalPrimo ?? "").trim()
  }
  setManualDistaccoDraft(nextDraft)
  setShowDistaccoModal(true)
}

function applyDistaccoCorrections() {
  const cleaned: Record<number, string> = {}

  for (const row of previewRows) {
    const draftValue = String(manualDistaccoDraft[row.sourcePosGara] ?? "").trim()
    const originalValue = String(row.distaccoDalPrimo ?? "").trim()

    if (draftValue && draftValue !== originalValue) {
      cleaned[row.sourcePosGara] = draftValue
    }
  }

  setManualDistaccoOverrides(cleaned)
  setShowDistaccoModal(false)
}

function resetDistaccoCorrections() {
  setManualDistaccoOverrides({})
  setManualDistaccoDraft({})
  setShowDistaccoModal(false)
}

function resetAllManualCorrections() {
  setManualPilotOverrides({})
  setManualPilotDraft({})
  setManualAutoOverrides({})
  setPilotModalRows([])
  setShowPilotModal(false)

  setManualDistaccoOverrides({})
  setManualDistaccoDraft({})
  setShowDistaccoModal(false)
}

  const showMeta = prtMode || unionMode
  const showLobby = unionMode

  const showTeamInsteadOfAutoInSprintTables = true
const hideQualifyingColumnInCurrentSprint = false

if (!authChecked || showSplash) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#05070b",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          animation: "bmwSplashFade 10s ease forwards",
        }}
      >
        <div
  style={{
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 16px",
  }}
>
  <div
    style={{
      display: "grid",
      justifyItems: "center",
      gap: 14,
      width: "100%",
    }}
  >
    <div
      style={{
        width: "min(74vw, 960px)",
        borderRadius: 28,
        overflow: "hidden",
        animation: "bmwGlowCycle 4s ease-in-out infinite",
        display: "block",
        lineHeight: 0,
      }}
    >
      <img
        src="/bmw-splash.png"
        alt="BMW M2 TEAM CUP"
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: 28,
        }}
      />
    </div>

    <div
      style={{
        display: "grid",
        gap: 10,
        justifyItems: "center",
        width: "min(74vw, 720px)",
      }}
    >
      <div
        style={{
          padding: "6px 14px",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: "#ffffff",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.18)",
          animation: "bmwTextGlow 3s ease-in-out infinite",
          boxShadow: "0 0 20px rgba(0,0,0,0.35)",
        }}
      >
        Caricamento
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          justifyContent: "center",
          gap: 6,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: 24 }).map((_, i) => {
          const color =
            i % 3 === 0
              ? "#6fd3ff"
              : i % 3 === 1
                ? "#6a3dff"
                : "#ff3b3b"

          return (
            <span
              key={i}
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: -1,
                color,
                textShadow: `0 0 10px ${color}55`,
                animation: `bmwSlashPulse 1.15s ease-in-out infinite`,
                animationDelay: `${i * 0.07}s`,
              }}
            >
              ///
            </span>
          )
        })}
      </div>
    </div>
  </div>
</div>
      </div>
    </div>
  )
}
if (!authorized) {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        color: "white",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        background:
          "radial-gradient(1200px 600px at 15% 10%, rgba(255,215,0,0.14), transparent 50%)," +
          "radial-gradient(900px 500px at 85% 20%, rgba(160,90,255,0.16), transparent 50%)," +
          "linear-gradient(180deg, #0b0d12 0%, #07080c 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 24,
          padding: "30px 26px",
          background: "rgba(14,18,32,0.88)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 0 60px rgba(0,0,0,0.35)",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ textAlign: "center", display: "grid", gap: 10 }}>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            BMW M2 TEAM CUP
          </div>

          <div
            style={{
              fontSize: 14,
              opacity: 0.74,
            }}
          >
            Accesso riservato
          </div>
        </div>

        <input
          type="password"
          value={inputPassword}
          onChange={(e) => setInputPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin()
          }}
          placeholder="Inserisci password"
          autoFocus
          style={{
            width: "100%",
            height: 58,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.05)",
            color: "#ffffff",
            padding: "0 18px",
            fontSize: 16,
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        {loginError && (
          <div
            style={{
              fontSize: 13,
              color: "#ff9c9c",
              background: "rgba(255,80,80,0.08)",
              border: "1px solid rgba(255,80,80,0.22)",
              borderRadius: 12,
              padding: "10px 12px",
            }}
          >
            {loginError}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={!inputPassword.trim()}
          style={{
            width: "100%",
            height: 58,
            borderRadius: 14,
            border: "1px solid rgba(255,215,0,0.35)",
            background: !inputPassword.trim()
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(135deg, rgba(255,215,0,0.96), rgba(255,190,40,0.94))",
            color: "#111522",
            fontSize: 16,
            fontWeight: 900,
            cursor: !inputPassword.trim() ? "not-allowed" : "pointer",
            textTransform: "uppercase",
            letterSpacing: 0.6,
          }}
        >
          Accedi
        </button>
      </div>
    </div>
  )
}
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        color: "white",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        background:
          "radial-gradient(1200px 600px at 15% 10%, rgba(255,215,0,0.14), transparent 50%)," +
          "radial-gradient(900px 500px at 85% 20%, rgba(160,90,255,0.16), transparent 50%)," +
          "linear-gradient(180deg, #0b0d12 0%, #07080c 100%)",
      }}
    >
      <div ref={topPageRef} style={{ maxWidth: 1600, margin: "0 auto" }}>
        <AppHeader />

        <div
          style={{
            marginTop: 14,
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.05)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: 18, borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
      <HeaderBadge label="WINNER" value={winner} variant="silver" />

      <Separator />

      <HeaderBadge label="POLE (QUALIFICA)" value={bestQuali} variant="gold" />

      <Separator />

      <HeaderBadge label="BEST LAP (GARA)" value={bestRaceLap} variant="violet" />

      {showMeta && (
        <>
          <Separator />
          <HeaderBadge label="LEGA" value={effectiveLegaResolved} variant="gold" />
        </>
      )}

            {showMeta && (
        <>
          <Separator />
          <HeaderBadge label="GARA" value={normalizedGaraForOutput} variant="violet" />
        </>
      )}

      {showMeta && (
        <>
          <Separator />
          <HeaderBadge
            label="SPRINT"
            value={String(currentSprint)}
            variant={currentSprint === 1 ? "sprint1" : "sprint2"}
          />
        </>
      )}

      {showLobby && (
        <>
          <Separator />
          <HeaderBadge label="LOBBY" value={unionMeta.lobby} variant="gold" />
        </>
      )}
    </div>

    <div style={{ position: "relative" }}>
  <button
    onClick={() => setShowRoundSelector((v) => !v)}
    style={{
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.14)",
      background: "rgba(0,0,0,0.18)",
      color: "white",
      cursor: "pointer",
      fontWeight: 900,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      fontSize: 12,
      minWidth: 120,
    }}
    title="Seleziona round attivo"
  >
    {`Round R${currentRound} ▾`}
  </button>

  {showRoundSelector && (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        minWidth: 140,
        padding: 8,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
        display: "grid",
        gap: 6,
        zIndex: 1000,
      }}
    >
      {[1, 2, 3, 4].map((round) => {
        const isActive = currentRound === round

        return (
          <button
            key={round}
            onClick={() => {
              requestRoundChange(round as 1 | 2 | 3 | 4)
              setShowRoundSelector(false)
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: isActive
                ? "1px solid rgba(255,215,0,0.35)"
                : "1px solid rgba(255,255,255,0.10)",
              background: isActive
                ? "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.08))"
                : "rgba(255,255,255,0.05)",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: 12,
              letterSpacing: 0.4,
            }}
          >
            {isActive ? `R${round} • attivo` : `Vai a R${round}`}
          </button>
        )
      })}
    </div>
  )}
</div>
  </div>

  {false && showReq && (
  <div style={{ marginTop: 10, fontSize: 13, opacity: 0.82, lineHeight: 1.45 }}>
    ...
  </div>
)}
</div>

          <div style={{ padding: 18, display: "grid", gap: 16 }}>

  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, opacity: 0.95 }}>Caricamento immagini</div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: showTable ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.06)",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 800,
                      letterSpacing: 0.3,
                      fontSize: 12,
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={showTable}
                      onChange={(e) => setShowTable(e.target.checked)}
                      style={{ transform: "scale(1.1)" }}
                    />
                    Mostra anteprima a colonne
                  </label>

                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: prtMode ? "rgba(160,90,255,0.16)" : "rgba(255,255,255,0.06)",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 800,
                      letterSpacing: 0.3,
                      fontSize: 12,
                      userSelect: "none",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={prtMode}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setPrtMode(checked)
                        if (checked) setUnionMode(false)
                        if (!checked && !unionMode) setUnionMode(true)
                      }}
                      style={{ transform: "scale(1.1)" }}
                    />
                    Modalità PRT
                  </label>
                  <label
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: bmwCupMode ? "rgba(34,197,94,0.16)" : "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
    letterSpacing: 0.3,
    fontSize: 12,
    userSelect: "none",
  }}
>
  <input
    type="checkbox"
    checked={bmwCupMode}
    onChange={(e) => setBmwCupMode(e.target.checked)}
    style={{ transform: "scale(1.1)" }}
  />
  Modalità BMW CUP
</label>
                </div>
              </div>

              <input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  multiple
  onChange={(e) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles(selectedFiles)

    if (pendingSprint2Upload && selectedFiles.length > 0) {
      setCurrentSprint(2)
      setShowSprintInfo(false)
      setPendingSprint2Upload(false)
      setSprint2Ready(true)
      setShowSprint2UploadConfirm(true)
    }
  }}
  style={{ display: "none" }}
/>

<input
  ref={backupImportRef}
  type="file"
  accept=".json,application/json"
  onChange={handleBackupImportChange}
  style={{ display: "none" }}
/>

<div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
  <button
    onClick={() => fileInputRef.current?.click()}
    style={{
      padding: "12px 16px",
      borderRadius: 14,
      border: "1px solid rgba(255,215,0,0.35)",
      background: "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(0,0,0,0.10))",
      color: "white",
      fontWeight: 900,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      cursor: "pointer",
      boxShadow: "0 0 24px rgba(255,215,0,0.12)",
    }}
  >
    Carica File
  </button>

  <div style={{ fontSize: 12, opacity: 0.8 }}>
    Carica 2–4 immagini (Qualifica + Gara). Ordine consigliato: Quali 1–8, Quali 9–N, Gara 1–8, Gara 9–N
    <span style={{ opacity: 0 }}>.</span>
  </div>
</div>

{files.length > 0 && (
  <div
    style={{
      fontSize: 12,
      opacity: 0.88,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.03)",
      padding: "10px 12px",
    }}
  >
    <b>{files.length}</b> file selezionati
    <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
      {files.slice(0, 8).map((f) => (
        <div key={f.name} style={{ opacity: 0.86 }}>
          • {f.name}
        </div>
      ))}
      {files.length > 8 && <div style={{ opacity: 0.75 }}>• ... +{files.length - 8}</div>}
    </div>
  </div>
)}

<div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
  <button
    onClick={run}
    disabled={loading || !canRun}
    style={{
      padding: "12px 16px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.18)",
      background: loading || !canRun ? "rgba(255,255,255,0.08)" : "rgba(255,215,0,0.18)",
      color: "white",
      fontWeight: 900,
      letterSpacing: 0.6,
      cursor: loading || !canRun ? "not-allowed" : "pointer",
      boxShadow: loading || !canRun ? "none" : "0 0 22px rgba(255,215,0,0.12)",
      textTransform: "uppercase",
    }}
  >
    {loading ? "Elaborazione..." : "GENERA ESTRAZIONE TABELLA"}
  </button>

  <button
    onClick={resetAll}
    style={{
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(255,255,255,0.06)",
      color: "white",
      cursor: "pointer",
      opacity: 0.9,
      textTransform: "uppercase",
      fontWeight: 900,
      letterSpacing: 0.4,
      fontSize: 12,
    }}
  >
    Reset
  </button>

  <button
  onClick={handleLogout}
  style={{
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,80,80,0.35)",
    background: "rgba(255,80,80,0.18)",
    color: "white",
    cursor: "pointer",
    opacity: 0.95,
    textTransform: "uppercase",
    fontWeight: 900,
    letterSpacing: 0.4,
    fontSize: 12,
    boxShadow: "0 0 18px rgba(255,80,80,0.12)",
  }}
>
  Logout
</button>

  <button
    onClick={exportPortableBackup}
    style={{
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(34,197,94,0.30)",
      background: "rgba(34,197,94,0.14)",
      color: "white",
      cursor: "pointer",
      opacity: 0.95,
      textTransform: "uppercase",
      fontWeight: 900,
      letterSpacing: 0.4,
      fontSize: 12,
    }}
  >
    Esporta backup
  </button>

  <button
    onClick={() => backupImportRef.current?.click()}
    style={{
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(96,165,250,0.30)",
      background: "rgba(96,165,250,0.14)",
      color: "white",
      cursor: "pointer",
      opacity: 0.95,
      textTransform: "uppercase",
      fontWeight: 900,
      letterSpacing: 0.4,
      fontSize: 12,
    }}
  >
    Importa backup
  </button>
</div>

{sprint2Ready && (
  <div
    style={{
      marginTop: -2,
      padding: "10px 12px",
      borderRadius: 10,
      background: "rgba(34,197,94,0.15)",
      border: "1px solid rgba(34,197,94,0.40)",
      fontSize: 13,
      fontWeight: 700,
      color: "white",
    }}
  >
    ✅ SPRINT 2 pronta — ora premi <b>GENERA ESTRAZIONE TABELLA</b>
  </div>
)}


              {finalRows.length > 0 && (
  <div style={{ display: "grid", gap: 12 }}>
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        ...overallBoxStyle(matchSummary.overallStatus),
        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 0.2 }}>
          {matchSummary.overallStatus === "ok"
            ? "✅ MATCH 100%"
            : matchSummary.overallStatus === "warn"
              ? "⚠️ DA CONTROLLARE"
              : "❌ ERRORE REALE"}
        </div>

        <div style={{ fontSize: 14, fontWeight: 900 }}>
          Match esatto al {matchSummary.percentage}%
        </div>
      </div>

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))",
          gap: 8,
          padding: "8px 10px",
          overflow: "hidden",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.20)",
          boxShadow: "0 0 24px rgba(255,215,0,0.06)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            background:
              "linear-gradient(90deg, transparent, rgba(255,215,0,0.18), transparent)",
            opacity: 0.35,
            animation: "unionLoadShine 4s linear infinite",
            pointerEvents: "none",
          }}
        />

        {[
  ["#", matchSummary.fields.posizione],
  ["Pilota", matchSummary.fields.pilota],
  ["Distacchi", matchSummary.fields.distacchi],
  ...(currentSprint === 1
    ? ([["PP", matchSummary.fields.pp]] as [string, MatchFieldStatus][])
    : []),
  ["GV", matchSummary.fields.gv],
  ["Gara", matchSummary.fields.gara],
  ["Lega", matchSummary.fields.lega],
  ...(unionMode
    ? ([["Lobby", matchSummary.fields.lobby]] as [string, MatchFieldStatus][])
    : []),
].map(([label, status]) => (
          <div
            key={label}
            style={{
              position: "relative",
              zIndex: 1,
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.3,
              whiteSpace: "nowrap",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(6px)",
              ...matchCellStyle(status as MatchFieldStatus),
            }}
          >
            {label} {statusBadge(status as MatchFieldStatus)}
          </div>
        ))}
      </div>

      {matchSummary.notes.length > 0 && (
        <div
          style={{
            fontSize: 11,
            opacity: 0.9,
            lineHeight: 1.4,
          }}
        >
          <b>Note:</b>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            {matchSummary.notes.map((note, idx) => (
              <li key={`${note}-${idx}`}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>

    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
  <button
    onClick={openExportModal}
    disabled={exporting}
    style={{
      padding: "12px 16px",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.16)",
      background: exporting ? "rgba(255,255,255,0.08)" : "rgba(160,90,255,0.18)",
      color: "white",
      fontWeight: 900,
      letterSpacing: 0.6,
      cursor: exporting ? "not-allowed" : "pointer",
      boxShadow: exporting ? "none" : "0 0 22px rgba(160,90,255,0.12)",
      textTransform: "uppercase",
    }}
  >
    {exporting ? "Esportazione PNG..." : "Esporta PNG tabella"}
  </button>

  <button
  onClick={() => {
    setExportTarget("html")
    setExportTextsDraft(exportTexts)
    setShowExportModal(true)
  }}
  disabled={exportingHtml}
  style={{
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.30)",
    background: exportingHtml ? "rgba(255,255,255,0.08)" : "rgba(96,165,250,0.18)",
    color: "white",
    fontWeight: 900,
    letterSpacing: 0.6,
    cursor: exportingHtml ? "not-allowed" : "pointer",
    boxShadow: exportingHtml ? "none" : "0 0 22px rgba(96,165,250,0.12)",
    textTransform: "uppercase",
  }}
>
  {exportingHtml ? "Esportazione HTML..." : "Scarica HTML esteso"}
</button>
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(255,215,0,0.22)",
      background: exportMetaInPng ? "rgba(255,215,0,0.14)" : "rgba(255,255,255,0.06)",
      color: "white",
      cursor: "pointer",
      fontWeight: 900,
      letterSpacing: 0.4,
      textTransform: "uppercase",
      fontSize: 12,
      boxShadow: exportMetaInPng ? "0 0 18px rgba(255,215,0,0.10)" : "none",
      userSelect: "none",
    }}
  >
    <input
      type="checkbox"
      checked={exportMetaInPng}
      onChange={(e) => setExportMetaInPng(e.target.checked)}
      style={{ transform: "scale(1.1)" }}
    />
    Includi Lobby, Gara, Lega
  </label>

  {hasAnyPenalty && (
    <div style={{ fontSize: 12, opacity: 0.82 }}>
      PNG e CSV stanno usando la <b>classifica post-penalità</b>.
    </div>
  )}
</div>
  </div>
)}
            </div>
                        {loading && (
              <div
                style={{
                  width: "100%",
                  marginTop: -6,
                  paddingLeft: 6,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    height: 12,
                    maxWidth: 420,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.10)",
                    boxShadow: "inset 0 0 14px rgba(0,0,0,0.25)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 999,
                      background:
                        "linear-gradient(90deg, rgba(255,215,0,0.08), rgba(220,220,220,0.06), rgba(160,90,255,0.08))",
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "-35%",
                      width: "35%",
                      borderRadius: 999,
                      background:
                        "linear-gradient(90deg, rgba(255,215,0,0.95), rgba(220,220,220,0.95), rgba(160,90,255,0.95))",
                      boxShadow:
                        "0 0 18px rgba(255,215,0,0.25), 0 0 22px rgba(160,90,255,0.18)",
                      animation: "unionLoadSlide 2.8s ease-in-out infinite",
                    }}
                  />

                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "-20%",
                      width: "20%",
                      borderRadius: 999,
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.42), rgba(255,255,255,0))",
                      filter: "blur(2px)",
                      animation: "unionLoadShine 2.8s ease-in-out infinite",
                    }}
                  />
                </div>

                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Elaborazione immagini e generazione CSV...
                </div>
              </div>
            )}

            {error && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  color: "#ff6b6b",
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  padding: 12,
                  borderRadius: 14,
                  overflowX: "auto",
                }}
              >
                {error}
              </pre>
            )}

            {displayRows.length > 0 && (
  <div
    style={{
      display: "grid",
      gap: 10,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(255,255,255,0.04)",
    }}
  >
    <div style={{ fontWeight: 900, fontSize: 13, opacity: 0.9 }}>
      Correzioni Manuali
    </div>

    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {/* === NUMERO GARA SEMPRE VISIBILE === */}
      <div style={{ display: "grid", gap: 4 }}>
        <label
          style={{
            fontSize: 11,
            opacity: 0.7,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          Numero Gara
        </label>

        <input
          value={manualGaraOverride ?? ""}
          onChange={(e) => setManualGaraOverride(e.target.value)}
          placeholder={`Rilevato: ${normalizedGaraForOutput || "-"}`}
          style={{
            width: 120,
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(0,0,0,0.26)",
            color: "white",
            fontWeight: 800,
            textAlign: "center",
          }}
        />
      </div>

      {/* === LEGA (rimane condizionale, ma puoi farla sempre visibile se vuoi) === */}
      {matchSummary.fields.lega === "warn" && (
        <div style={{ display: "grid", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              opacity: 0.7,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            Lega
          </label>

          <select
            value={manualLegaOverride ?? ""}
            onChange={(e) => setManualLegaOverride(e.target.value)}
            style={{
              width: 140,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.26)",
              color: "white",
              fontWeight: 800,
            }}
          >
            <option value="">Seleziona</option>
            <option value="PRO">PRO</option>
            <option value="PRO-AMA">PRO-AMA</option>
            <option value="AMA">AMA</option>
          </select>
        </div>
      )}
    </div>

    <div style={{ fontSize: 11, opacity: 0.65 }}>
      Se inserisci un valore manuale, sovrascriverà quello rilevato automaticamente.
    </div>
  </div>
)}

{showTable && finalRows.length > 0 && (
  <div style={{ display: "grid", gap: 14 }}>
    <ResultsTable
  previewRows={finalRows}
  bestRaceLap={bestRaceLap}
  unionMeta={{ ...unionMeta, gara: normalizedGaraForOutput, lega: effectiveLegaResolved }}
  prtMode={prtMode}
  unionMode={unionMode}
  currentSprint={currentSprint}
  penalties={penalties}
  tableTitle={`Classifica Sprint ${currentSprint} (output)`}
  showTeamInsteadOfAuto={showTeamInsteadOfAutoInSprintTables}
  hideQualifyingColumn={hideQualifyingColumnInCurrentSprint}
  resolveTeamName={(row) => resolveTeamForDisplayRow(row)}
/>

    {displayRows.length > 0 && (
      <div
        style={{
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          padding: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800 }}>
          Correzioni Manuali
        </div>

        <button
          onClick={openPilotCorrectionModal}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Modifica Pilota
        </button>

        <button
          onClick={openDistaccoCorrectionModal}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(255,255,255,0.08)",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Modifica Distacco
        </button>

        <button
          onClick={resetAllManualCorrections}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.14)",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            textTransform: "uppercase",
            fontSize: 12,
          }}
        >
          Reset correzioni manuali
        </button>
      </div>
    )}

    {displayRows.length > 0 && (
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.18)",
          padding: 14,
          display: "grid",
          gap: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 900, opacity: 0.96 }}>Direzione Gara</div>
            <div style={{ fontSize: 12, opacity: 0.72 }}>
              Gestione penalità, doppiati e stati finali senza modificare il motore OCR.
            </div>
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.05)",
              fontSize: 12,
              opacity: 0.82,
              fontWeight: 800,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            Ordine DG: Pilota • Penalità • Gap doppiato • DNF/DNFV
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            opacity: 0.82,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            lineHeight: 1.45,
          }}
        >
          In esportazione PNG il dettaglio penalità nel formato <b>P05 Lap3 04:47</b> viene mostrato solo in <b>modalità PRT</b>. In <b>UNION</b> nel PNG resta visibile solo il totale penalità.
          <br />
          Le penalità possono essere inserite anche per i piloti <b>doppiati</b> senza gap finale manuale, ma <b>non influenzano la classifica</b> finché il gap non viene compilato.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => setShowDgTable((v) => !v)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
              textTransform: "uppercase",
              fontSize: 12,
            }}
          >
            {showDgTable ? "Chiudi tabella DG" : "Apri tabella DG"}
          </button>
        </div>

        {showDgTable && (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  background: "rgba(10,12,18,0.95)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <tr>
                  <th
                    style={{
                      padding: "10px 10px",
                      textAlign: "left",
                      fontSize: 11,
                      opacity: 0.82,
                      width: "18%",
                    }}
                  >
                    Pilota
                  </th>

                  <th
                    style={{
                      padding: "10px 10px",
                      textAlign: "center",
                      fontSize: 11,
                      opacity: 0.82,
                      width: "50%",
                    }}
                  >
                    Penalità
                  </th>

                  <th
                    style={{
                      padding: "10px 10px",
                      textAlign: "center",
                      fontSize: 11,
                      opacity: 0.82,
                      width: "17%",
                    }}
                  >
                    Gap finale doppiato
                  </th>

                  <th
                    style={{
                      padding: "10px 10px",
                      textAlign: "center",
                      fontSize: 11,
                      opacity: 0.82,
                      width: "15%",
                    }}
                  >
                    DNF / DNFV
                  </th>
                </tr>
              </thead>

              <tbody>
                {dgInfo.map(({ row, isDoppiato, isDnf, key, manualGap, manualGapValid }, idx) => {
                  const dnfValue = dnfOverrides[key] || "DNF-I"
                  const entries = penalties[key] || []
                  const penaltyMain = getPenaltyMainDisplay(entries)
                  const penaltyDisabled = false

                  return (
                    <tr
                      key={`dg-${row.sourcePosGara}-${row.pilota}-${idx}`}
                      style={{
                        background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.10)",
                      }}
                    >
                      <TableCell>{row.pilota}</TableCell>

                      <TableCell align="center">
                        <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                          <div style={{ display: "grid", gap: 6, width: "100%" }}>
                            {entries.map((entry) => (
                              <div
                                key={entry.id}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "95px 82px 66px 66px 32px",
                                  gap: 8,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <select
                                  disabled={penaltyDisabled}
                                  value={entry.code}
                                  onChange={(e) => updatePenaltyEntry(row.sourcePosGara, entry.id, { code: e.target.value })}
                                  style={{
                                    padding: "7px 8px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: penaltyDisabled ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.26)",
                                    color: "white",
                                    opacity: penaltyDisabled ? 0.65 : 1,
                                  }}
                                >
                                  {penaltyCodeOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value} style={{ background: "#11151d", color: "white" }}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  disabled={penaltyDisabled}
                                  value={entry.lap}
                                  onChange={(e) => updatePenaltyEntry(row.sourcePosGara, entry.id, { lap: e.target.value })}
                                  style={{
                                    padding: "7px 8px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: penaltyDisabled ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.26)",
                                    color: "white",
                                    opacity: penaltyDisabled ? 0.65 : 1,
                                  }}
                                >
                                  {lapOptions.map((lap) => (
                                    <option key={lap} value={lap} style={{ background: "#11151d", color: "white" }}>
                                      {lap}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  disabled={penaltyDisabled}
                                  value={entry.minute}
                                  onChange={(e) => updatePenaltyEntry(row.sourcePosGara, entry.id, { minute: e.target.value })}
                                  style={{
                                    padding: "7px 8px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: penaltyDisabled ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.26)",
                                    color: "white",
                                    opacity: penaltyDisabled ? 0.65 : 1,
                                    textAlign: "center",
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                  }}
                                >
                                  {minuteOptions.map((m) => (
                                    <option key={m} value={m} style={{ background: "#11151d", color: "white" }}>
                                      {m}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  disabled={penaltyDisabled}
                                  value={entry.second}
                                  onChange={(e) => updatePenaltyEntry(row.sourcePosGara, entry.id, { second: e.target.value })}
                                  style={{
                                    padding: "7px 8px",
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: penaltyDisabled ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.26)",
                                    color: "white",
                                    opacity: penaltyDisabled ? 0.65 : 1,
                                    textAlign: "center",
                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                  }}
                                >
                                  {secondOptions.map((s) => (
                                    <option key={s} value={s} style={{ background: "#11151d", color: "white" }}>
                                      {s}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  disabled={penaltyDisabled}
                                  onClick={() => removePenaltyEntry(row.sourcePosGara, entry.id)}
                                  style={{
                                    width: 36,
                                    height: 32,
                                    borderRadius: 10,
                                    border: "1px solid rgba(255,255,255,0.14)",
                                    background: "rgba(255,255,255,0.06)",
                                    color: "white",
                                    cursor: penaltyDisabled ? "not-allowed" : "pointer",
                                    opacity: penaltyDisabled ? 0.65 : 1,
                                  }}
                                  title="Rimuovi penalità"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>

                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                            <button
                              disabled={penaltyDisabled}
                              onClick={() => addPenaltyEntry(row.sourcePosGara)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.14)",
                                background: penaltyDisabled ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.26)",
                                color: "white",
                                cursor: penaltyDisabled ? "not-allowed" : "pointer",
                                opacity: penaltyDisabled ? 0.65 : 1,
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              + Penalità
                            </button>

                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.88,
                                fontWeight: 900,
                                color:
                                  penaltyMain.kind === "dsq"
                                    ? "#ff7cff"
                                    : penaltyMain.kind === "ammonition"
                                      ? "#f59e0b"
                                      : penaltyMain.kind === "time"
                                        ? "#ffb3b3"
                                        : "rgba(255,255,255,0.65)",
                              }}
                            >
                              Totale DG: {penaltyMain.text}
                            </div>
                          </div>

                          {entries.length > 0 && (
                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.85,
                                borderTop: "1px solid rgba(255,255,255,0.08)",
                                paddingTop: 8,
                                width: "100%",
                                textAlign: "center",
                                whiteSpace: "normal",
                                lineHeight: 1.35,
                              }}
                            >
                              {entries.map((entry) => formatPenaltyDetail(entry)).join(" • ")}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell align="center">
                        {isDoppiato ? (
                          <div style={{ display: "grid", gap: 6, justifyItems: "center" }}>
                            <input
                              value={manualGap}
                              onChange={(e) => setLapOverrideValue(row.sourcePosGara, e.target.value)}
                              placeholder="1:14.960"
                              style={{
                                width: 130,
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.14)",
                                background: "rgba(0,0,0,0.26)",
                                color: "white",
                                textAlign: "center",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                              }}
                            />
                            <div
                              style={{
                                fontSize: 11,
                                opacity: manualGapValid ? 0.65 : 1,
                                color: manualGapValid ? "rgba(255,255,255,0.65)" : "#ff8a8a",
                              }}
                            >
                              {manualGap.trim()
                                ? manualGapValid
                                  ? "Gap finale valido"
                                  : "Usa m:ss.mmm"
                                : "Inserisci il gap dal pilota che precede"}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      <TableCell align="center">
                        {isDnf ? (
                          <select
  value={dnfValue}
  onChange={(e) => setDnfOverrideValue(row.sourcePosGara, e.target.value)}
  style={{
    minWidth: 120,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.26)",
    color: "white",
  }}
>
  <option value="DNF-I" style={{ background: "#11151d", color: "white" }}>
    DNF-I
  </option>
  <option value="DNF-V" style={{ background: "#11151d", color: "white" }}>
    DNF-V
  </option>
</select>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )}
  </div>
)}

{teamLookupPreview.length > 0 && (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontWeight: 900, opacity: 0.96 }}>
        Matching pilota → team
      </div>

      <button
        onClick={() => setShowMatchDetails((v) => !v)}
        style={{
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.06)",
          color: "white",
          cursor: "pointer",
          fontWeight: 800,
          fontSize: 11,
          textTransform: "uppercase",
        }}
      >
        {showMatchDetails ? "CHIUDI MATCH" : "APRI MATCH"}
      </button>
    </div>

    {showMatchDetails && (
      <div
        style={{
          display: "grid",
          gap: 8,
          fontSize: 13,
        }}
      >
        {teamLookupPreview.map((item, idx) => (
          <div
            key={`${item.pilota}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 220px) minmax(220px, 1fr) 120px",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 800 }}>{item.pilota || "-"}</div>
            <div style={{ opacity: 0.9 }}>{item.team}</div>
            <div
              style={{
                textAlign: "center",
                fontWeight: 900,
                borderRadius: 999,
                padding: "6px 10px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
            >
              {item.lega}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

{hasSavedLeaguesInCurrentRound && (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 900, opacity: 0.96 }}>
          Archivio leghe salvate nel Round corrente
        </div>
        <div style={{ fontSize: 12, opacity: 0.74 }}>
          Riapri rapidamente una lega già salvata, scegli la sprint da caricare e modifica direttamente la sessione prima di sovrascriverla.
        </div>
      </div>

      <div
        style={{
          padding: "8px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          fontSize: 12,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        Round {currentRound}
      </div>
    </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 12,
      }}
    >
      {(["PRO", "PRO-AMA", "AMA"] as BmwLeagueName[]).map((league) => {
        const snapshot = currentRoundSnapshot?.leagues?.[league] || null
        const hasSprint1 = !!snapshot?.sprint1
        const hasSprint2 = !!snapshot?.sprint2
        const isComplete = hasSprint1 && hasSprint2

        return (
          <div
            key={league}
            style={{
              borderRadius: 14,
              border: snapshot
                ? "1px solid rgba(255,255,255,0.12)"
                : "1px solid rgba(255,255,255,0.08)",
              background: snapshot
                ? "rgba(255,255,255,0.05)"
                : "rgba(255,255,255,0.03)",
              padding: 12,
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, letterSpacing: 0.4 }}>
                {league}
              </div>

              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: !snapshot
                    ? "rgba(255,255,255,0.05)"
                    : isComplete
                      ? "rgba(34,197,94,0.14)"
                      : "rgba(245,158,11,0.14)",
                  fontSize: 11,
                  fontWeight: 900,
                  textTransform: "uppercase",
                }}
              >
                {!snapshot ? "vuota" : isComplete ? "completa" : "parziale"}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 6,
                fontSize: 12,
                opacity: 0.82,
              }}
            >
              <div>
                Sprint 1: <b>{hasSprint1 ? "salvata" : "non salvata"}</b>
              </div>
              <div>
                Sprint 2: <b>{hasSprint2 ? "salvata" : "non salvata"}</b>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 8,
              }}
            >
              <button
                onClick={() => openReopenLeagueModal(league)}
                disabled={!snapshot}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(160,90,255,0.30)",
                  background: snapshot ? "rgba(160,90,255,0.20)" : "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: snapshot ? "pointer" : "not-allowed",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  fontSize: 12,
                  opacity: snapshot ? 1 : 0.5,
                  boxShadow: snapshot ? "0 0 18px rgba(160,90,255,0.10)" : "none",
                }}
              >
                Riapri lega
              </button>

              <button
                onClick={() => openResetLeagueModal(league)}
                disabled={!snapshot}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(239,68,68,0.30)",
                  background: snapshot ? "rgba(239,68,68,0.16)" : "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: snapshot ? "pointer" : "not-allowed",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  fontSize: 12,
                  opacity: snapshot ? 1 : 0.5,
                  boxShadow: snapshot ? "0 0 18px rgba(239,68,68,0.08)" : "none",
                }}
              >
                Resetta lega
              </button>
            </div>
          </div>
        )
      })}
    </div>

    <div
      style={{
        marginTop: 4,
        display: "flex",
        justifyContent: "stretch",
      }}
    >
      <button
        onClick={() => setShowResetAllLeaguesModal(true)}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "1px solid rgba(239,68,68,0.30)",
          background: "rgba(239,68,68,0.16)",
          color: "white",
          cursor: "pointer",
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontSize: 12,
          boxShadow: "0 0 18px rgba(239,68,68,0.08)",
        }}
      >
        Resetta tutte le leghe del round corrente → ROUND {currentRound}
      </button>
    </div>
  </div>
)}

{bmwSprintDriversPreview.length > 0 && (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
    <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  }}
>
  <div
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  }}
>
  <div style={{ fontWeight: 900, opacity: 0.96 }}>
    Preview Sprint attuale
  </div>

  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 14px",
      borderRadius: 999,
      border:
        currentSprint === 1
          ? "1px solid rgba(255,215,0,0.38)"
          : "1px solid rgba(34,197,94,0.38)",
      background:
        currentSprint === 1
          ? "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.08))"
          : "linear-gradient(180deg, rgba(34,197,94,0.18), rgba(34,197,94,0.08))",
      boxShadow:
        currentSprint === 1
          ? "0 0 18px rgba(255,215,0,0.12)"
          : "0 0 18px rgba(34,197,94,0.12)",
      color: "white",
      fontWeight: 900,
      letterSpacing: 0.8,
      whiteSpace: "nowrap",
      textTransform: "uppercase",
      fontSize: 12,
    }}
  >
    SPRINT {currentSprint}
  </div>
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>

    <button
  onClick={saveCurrentSprint}
  style={{
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.30)",
    background: "rgba(34,197,94,0.16)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 12,
  }}
>
  {isReopenedSavedSprint
    ? currentSprint === 1
      ? "SOVRASCRIVI SPRINT 1"
      : "SOVRASCRIVI SPRINT 2"
    : currentSprint === 1
      ? "SALVA SPRINT 1"
      : "SALVA SPRINT 2"}
</button>

    <button
      onClick={resetSavedSprints}
      style={{
        padding: "10px 14px",
        borderRadius: 12,
        border: "1px solid rgba(239,68,68,0.30)",
        background: "rgba(239,68,68,0.14)",
        color: "white",
        cursor: "pointer",
        fontWeight: 900,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        fontSize: 12,
      }}
    >
      Reset Sprint salvate
    </button>
  </div>
</div>

{(savedSprintPreviews.sprint1 || savedSprintPreviews.sprint2) && (
  <div
    style={{
      display: "grid",
      gap: 8,
      fontSize: 12,
      opacity: 0.82,
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(255,255,255,0.03)",
    }}
  >
    <div>
      Sprint 1: <b>{savedSprintPreviews.sprint1 ? "salvata" : "non salvata"}</b>
    </div>
    <div>
      Sprint 2: <b>{savedSprintPreviews.sprint2 ? "salvata" : "non salvata"}</b>
    </div>
  </div>
)}

        <div
      style={{
        overflowX: "auto",
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", gap: 8, fontSize: 13, minWidth: 980 }}>
        {bmwSprintDriversPreview.map((item, idx) => (
          <div
            key={`${item.driverId}-${idx}`}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(170px, 220px) minmax(220px, 1fr) 90px 90px 90px 90px 90px",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 800 }}>{item.driverName || "-"}</div>
            <div style={{ opacity: 0.9 }}>{item.team}</div>
            <div style={{ textAlign: "center" }}>{item.lega}</div>
            <div style={{ textAlign: "center" }}>{item.status}</div>
            <div style={{ textAlign: "center" }}>Base {item.basePoints}</div>
            <div style={{ textAlign: "center" }}>PP {item.poleBonus}</div>
            <div style={{ textAlign: "center", fontWeight: 900 }}>
              Tot {item.totalPoints}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}

{bmwLeagueDriversPreview.length > 0 && (
  <div
    ref={teamPreviewRef}
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
    <div style={{ fontWeight: 900, opacity: 0.96 }}>
      Preview classifica TEAM
    </div>

    <div style={{ display: "grid", gap: 8, fontSize: 13 }}>
      {bmwLeagueDriversPreview.map((item, idx) => (
        <div
          key={`${item.driverId}-${idx}`}
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(170px, 220px) minmax(220px, 1fr) 90px 90px 90px 110px 110px 90px",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 800 }}>{item.driverName || "-"}</div>
          <div style={{ opacity: 0.9 }}>{item.team}</div>
          <div style={{ textAlign: "center" }}>{item.lega}</div>
          <div style={{ textAlign: "center" }}>S1 {item.sprint1Points}</div>
          <div style={{ textAlign: "center" }}>S2 {item.sprint2Points}</div>
          <div style={{ textAlign: "center" }}>
            B+5 {item.bonusCompletion}
          </div>
          <div style={{ textAlign: "center" }}>
            {item.sprint1Status || "-"} / {item.sprint2Status || "-"}
          </div>
          <div style={{ textAlign: "center", fontWeight: 900 }}>
            TOT {item.totalPoints}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

{bmwLeagueDriversPreview.length > 0 && (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 900, opacity: 0.96 }}>
          Sistema Salvataggio Round BMW
        </div>
        <div style={{ fontSize: 12, opacity: 0.76 }}>
          Salva o sovrascrive il risultato della lega corrente nel round attuale.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.05)",
            fontSize: 12,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          Round {currentRound} • Lega {effectiveLegaResolved || "-"}
        </div>

        <button
  onClick={openConfirmSaveLeagueModal}
  style={{
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.30)",
    background: "rgba(34,197,94,0.16)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 12,
  }}
>
  {savedLeagueInCurrentRound ? "Sovrascrivi lega nel round" : "Salva lega nel round"}
</button>

<button
  onClick={resetCurrentLeagueInRound}
  style={{
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(245,158,11,0.30)",
    background: "rgba(245,158,11,0.14)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 12,
  }}
>
  Reset lega corrente
</button>

<button
  onClick={resetEntireCurrentRound}
  style={{
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(239,68,68,0.30)",
    background: "rgba(239,68,68,0.14)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 12,
  }}
>
  Reset round corrente
</button>
      </div>
        </div>

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }}
    >
      {[
        { label: "PRO", done: roundLeagueStatus.PRO },
        { label: "PRO-AMA", done: roundLeagueStatus["PRO-AMA"] },
        { label: "AMA", done: roundLeagueStatus.AMA },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            borderRadius: 12,
            padding: "12px 14px",
            border: item.done
              ? "1px solid rgba(34,197,94,0.35)"
              : "1px solid rgba(255,255,255,0.10)",
            background: item.done
              ? "rgba(34,197,94,0.14)"
              : "rgba(255,255,255,0.04)",
            boxShadow: item.done
              ? "0 0 18px rgba(34,197,94,0.10)"
              : "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <span style={{ fontWeight: 900, letterSpacing: 0.4 }}>
            {item.label}
          </span>

          <span style={{ fontSize: 18, lineHeight: 1 }}>
            {item.done ? "✅" : "⬜"}
          </span>
        </div>
      ))}
    </div>

    <div
      style={{
        display: "grid",
        gap: 8,
        fontSize: 13,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div>
        Round attuale: <b>R{currentRound}</b>
      </div>
      <div>
        Lega corrente: <b>{effectiveLegaResolved || "-"}</b>
      </div>
      <div>
        Sprint 1: <b>{savedSprintPreviews.sprint1 ? "salvata" : "non salvata"}</b>
      </div>
      <div>
        Sprint 2: <b>{savedSprintPreviews.sprint2 ? "salvata" : "non salvata"}</b>
      </div>
      <div>
        Stato lega nel round:{" "}
        <b>{savedLeagueInCurrentRound ? "già presente → verrà sovrascritta" : "non ancora salvata"}</b>
      </div>
      <div>
        Stato round:{" "}
        <b>{isCurrentRoundReady ? "completo → pronto per salvataggio finale" : "incompleto"}</b>
      </div>
    </div>
  </div>
)}

{isCurrentRoundReady && currentRoundSnapshot && (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(34,197,94,0.24)",
      background: "rgba(34,197,94,0.10)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 900, opacity: 0.96 }}>
          {isCurrentRoundAlreadySaved ? "✅ Round già salvato" : "✅ Round completo"}
        </div>
        <div style={{ fontSize: 12, opacity: 0.78 }}>
          {isCurrentRoundAlreadySaved
            ? "Questo round è già presente in classifica generale. Se hai modificato una lega, puoi sovrascriverlo."
            : "PRO, PRO-AMA e AMA sono state salvate. Ora puoi consolidare il round e metterlo in classifica generale."}
        </div>
      </div>

      <button
        onClick={openConfirmFinalizeRoundModal}
        style={{
          padding: "12px 16px",
          borderRadius: 14,
          border: "1px solid rgba(34,197,94,0.34)",
          background: "rgba(34,197,94,0.18)",
          color: "white",
          cursor: "pointer",
          fontWeight: 900,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          boxShadow: "0 0 22px rgba(34,197,94,0.12)",
        }}
      >
        {isCurrentRoundAlreadySaved
          ? "Sovrascrivi Round in classifica"
          : "Salva Round in classifica"}
      </button>
    </div>
  </div>
)}

{championshipTeams.length > 0 && (
  <div
    style={{
      borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.18)",
      padding: 14,
      display: "grid",
      gap: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
    }}
  >
        <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 900, opacity: 0.96 }}>
          Classifica Generale TEAM BMW CUP
        </div>

        <div style={{ fontSize: 12, opacity: 0.74 }}>
          Tabella viva progressiva round dopo round, usata anche come sorgente per l’export PNG definitivo.
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={performExportGeneralTeamsPng}
          disabled={exportingGeneralTeamsPng}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(255,215,0,0.30)",
            background: exportingGeneralTeamsPng
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.08))",
            color: "white",
            cursor: exportingGeneralTeamsPng ? "not-allowed" : "pointer",
            fontWeight: 900,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            fontSize: 11,
            boxShadow: exportingGeneralTeamsPng
              ? "none"
              : "0 0 18px rgba(255,215,0,0.12)",
          }}
        >
          {exportingGeneralTeamsPng
            ? "Esportazione PNG..."
            : "Esporta PNG Classifica Definitiva Round"}
        </button>

        <button
  onClick={() => {
  setExportTarget("html-teams")
  setExportTextsDraft(exportTexts)
  setShowExportModal(true)
}}
  disabled={exportingGeneralTeamsHtml}
  style={{
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(96,165,250,0.30)",
    background: exportingGeneralTeamsHtml
      ? "rgba(255,255,255,0.08)"
      : "rgba(96,165,250,0.18)",
    color: "white",
    cursor: exportingGeneralTeamsHtml ? "not-allowed" : "pointer",
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    fontSize: 11,
    boxShadow: exportingGeneralTeamsHtml
      ? "none"
      : "0 0 18px rgba(96,165,250,0.12)",
  }}
>
  {exportingGeneralTeamsHtml
    ? "Esportazione HTML..."
    : "Esporta HTML Classifica Generale"}
</button>

        <button
          onClick={() => setShowGeneralRoundDetails((v) => !v)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 11,
            textTransform: "uppercase",
          }}
        >
          {showGeneralRoundDetails ? "CHIUDI CLASSIFICA" : "APRI CLASSIFICA"}
        </button>
      </div>
    </div>

        {showGeneralRoundDetails && (
      <TeamChampionshipTable
  teams={championshipTeams}
  currentRound={currentRound}
  getTeamRoundDetail={getTeamRoundDetail}
/>
    )}
  </div>
)}

            {finalCsv && finalRows.length > 0 && (
              <div
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.22)",
                  padding: 14,
                  display: "grid",
                  gap: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.20)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontWeight: 900, opacity: 0.96 }}>
                      CSV Extractor Output {hasAnyPenalty ? "(post-penalità)" : ""}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>
                      Output finale pronto per copia, controllo rapido o download.
                    </div>
                  </div>

                  <a
                    href={"data:text/csv;charset=utf-8," + encodeURIComponent(finalCsv)}
                    download="albixximo_race_extractor.csv"
                    style={{
                      color: "white",
                      textDecoration: "none",
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(160,90,255,0.18)",
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                      boxShadow: "0 0 18px rgba(160,90,255,0.10)",
                    }}
                  >
                    Scarica CSV
                  </a>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    padding: 10,
                  }}
                >
                  <textarea
                    value={finalCsv}
                    readOnly
                    rows={14}
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(0,0,0,0.35)",
                      color: "white",
                      padding: 12,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: 12,
                      lineHeight: 1.45,
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            )}

            <div
              style={{
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(0,0,0,0.18)",
                padding: "10px 12px",
              }}
            >
              <LegendBare />
            </div>
          </div>
        </div>
      </div>

      {showExportModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
              boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
              padding: 20,
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>
  {exportTarget === "png"
    ? "Personalizza intestazione PNG"
    : exportTarget === "html-teams"
      ? "Personalizza intestazione HTML Classifica Generale"
      : "Personalizza intestazione HTML"}
</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
  {exportTarget === "png"
    ? "Modifichi solo il contenuto dei testi. Font, dimensioni e stile restano invariati."
    : exportTarget === "html-teams"
      ? "Questi testi verranno applicati all'export HTML della Classifica Generale TEAM."
      : "Questi testi verranno applicati all'export HTML esteso della tabella sprint."}
</div>
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.82, textTransform: "uppercase", fontWeight: 900 }}>
                  Titolo principale
                </label>
                <input
                  value={exportTextsDraft.mainTitle}
                  onChange={(e) => setExportTextsDraft((prev) => ({ ...prev, mainTitle: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.26)",
                    color: "white",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.82, textTransform: "uppercase", fontWeight: 900 }}>
                  Testo accanto
                </label>
                <input
                  value={exportTextsDraft.sideLabel}
                  onChange={(e) => setExportTextsDraft((prev) => ({ ...prev, sideLabel: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.26)",
                    color: "white",
                  }}
                />
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 12, opacity: 0.82, textTransform: "uppercase", fontWeight: 900 }}>
                  Testo piccolo sotto
                </label>
                <input
                  value={exportTextsDraft.subtitle}
                  onChange={(e) => setExportTextsDraft((prev) => ({ ...prev, subtitle: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(0,0,0,0.26)",
                    color: "white",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Annulla
              </button>

              <button
  onClick={confirmExportPng}
  style={{
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(160,90,255,0.30)",
    background: "rgba(160,90,255,0.20)",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    boxShadow: "0 0 22px rgba(160,90,255,0.12)",
  }}
>
  {exportTarget === "png"
    ? "Esporta PNG"
    : exportTarget === "html-teams"
      ? "Esporta HTML Classifica Generale"
      : "Esporta HTML"}
</button>
            </div>
          </div>
        </div>
      )}

      {showMissingPilotWarning && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>
        Attenzione
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        È presente almeno un <b>pilota non identificato</b>.
        <br /><br />
        Conviene inserire prima il nome mancante e solo dopo procedere con eventuali scambi tra piloti.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowMissingPilotWarning(false)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        <button
          onClick={continuePilotCorrectionModalAnyway}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(160,90,255,0.30)",
            background: "rgba(160,90,255,0.20)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(160,90,255,0.12)",
          }}
        >
          Continua comunque
        </button>
      </div>
    </div>
  </div>
)}

      {showPilotModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 1100,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Correzione Pilota Manuale</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Modifica manualmente il nome pilota. Le correzioni verranno applicate a tabella, DG, CSV e PNG.
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxHeight: "60vh",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "rgba(10,12,18,0.96)",
                backdropFilter: "blur(10px)",
              }}
            >
              <tr>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8, width: 100 }}>
                  Pos
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8, width: 320 }}>
                  Pilota OCR
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8 }}>
                  Pilota corretto
                </th>
              </tr>
            </thead>

            <tbody>
              {pilotModalRows.map((baseRow) => {
                const originalValue = String(baseRow.pilota ?? "").trim()

                const currentValue = String(
                  manualPilotDraft[baseRow.sourcePosGara] ?? originalValue
                ).trim()

                const changed = currentValue !== originalValue

                return (
                  <tr
                    key={`manual-pilot-${baseRow.sourcePosGara}`}
                    style={{
                      background: changed
                        ? "linear-gradient(90deg, rgba(160,90,255,0.10), rgba(255,255,255,0.02))"
                        : "transparent",
                    }}
                  >
                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <PosBadge pos={baseRow.posGara} />
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.86)",
                        fontWeight: 700,
                      }}
                    >
                      {originalValue || "-"}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div style={{ display: "grid", gap: 8 }}>
                        <input
                          value={manualPilotDraft[baseRow.sourcePosGara] ?? originalValue}
                          onChange={(e) =>
                            setManualPilotDraft((prev) => ({
                              ...prev,
                              [baseRow.sourcePosGara]: e.target.value,
                            }))
                          }
                          placeholder="Correggi nome pilota"
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: changed
                              ? "1px solid rgba(160,90,255,0.30)"
                              : "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(0,0,0,0.24)",
                            color: "white",
                            boxSizing: "border-box",
                          }}
                        />

                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const selected = e.target.value
                            if (!selected) return

                            const currentKey = baseRow.sourcePosGara

                            const otherRow = pilotModalRows.find(
                              (candidate) =>
                                candidate.sourcePosGara !== currentKey &&
                                String(
                                  manualPilotDraft[candidate.sourcePosGara] ??
                                    candidate.pilota ??
                                    ""
                                ).trim() === selected
                            )

                            if (!otherRow) {
                              e.currentTarget.value = ""
                              return
                            }

                            const otherKey = otherRow.sourcePosGara

                            setManualPilotDraft((prev) => {
                              const nextDraft: Record<number, string> = {}

                              for (const r of pilotModalRows) {
                                nextDraft[r.sourcePosGara] = String(
                                  prev[r.sourcePosGara] ??
                                    r.pilota ??
                                    ""
                                ).trim()
                              }

                              const currentPilot = nextDraft[currentKey]
                              const otherPilot = nextDraft[otherKey]

                              nextDraft[currentKey] = otherPilot
                              nextDraft[otherKey] = currentPilot

                              return nextDraft
                            })

                            e.currentTarget.value = ""
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.14)",
                            background: "rgba(0,0,0,0.24)",
                            color: "white",
                            boxSizing: "border-box",
                          }}
                        >
                          <option value="" style={{ background: "#11151d", color: "white" }}>
                            Scambia con...
                          </option>

                          {pilotModalRows
                            .filter((candidate) => candidate.sourcePosGara !== baseRow.sourcePosGara)
                            .map((candidate) => {
                              const candidateName = String(
                                manualPilotDraft[candidate.sourcePosGara] ??
                                  candidate.pilota ??
                                  ""
                              ).trim()

                              return (
                                <option
                                  key={`pilot-option-${baseRow.sourcePosGara}-${candidate.sourcePosGara}`}
                                  value={candidateName}
                                  style={{ background: "#11151d", color: "white" }}
                                >
                                  {candidateName}
                                </option>
                              )
                            })}
                        </select>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowPilotModal(false)
            setManualPilotDraft({})
            setPilotModalRows([])
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        <button
          onClick={resetPilotCorrections}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Reset
        </button>

        <button
          onClick={applyPilotCorrections}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(160,90,255,0.30)",
            background: "rgba(160,90,255,0.20)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(160,90,255,0.12)",
          }}
        >
          Applica correzioni
        </button>
      </div>
    </div>
  </div>
)}

{showDistaccoModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 1100,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>Correzione Distacco Manuale</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Inserisci un distacco manuale oppure uno stato come DOPPIATO, DNF, DNFV, BOX o DSQ.
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(0,0,0,0.22)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxHeight: "60vh",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <thead
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "rgba(10,12,18,0.96)",
                backdropFilter: "blur(10px)",
              }}
            >
              <tr>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8, width: 100 }}>
                  Pos
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8, width: 260 }}>
                  Pilota
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8, width: 220 }}>
                  Distacco OCR
                </th>
                <th style={{ padding: "12px", textAlign: "left", fontSize: 12, opacity: 0.8 }}>
                  Distacco corretto
                </th>
              </tr>
            </thead>

            <tbody>
              {displayRows.map((row) => {
                const currentValue = String(manualDistaccoDraft[row.sourcePosGara] ?? "").trim()
                const originalValue = String(row.distaccoDalPrimo ?? "").trim()
                const changed = currentValue !== originalValue

                return (
                  <tr
                    key={`manual-distacco-${row.sourcePosGara}`}
                    style={{
                      background: changed
                        ? "linear-gradient(90deg, rgba(160,90,255,0.10), rgba(255,255,255,0.02))"
                        : "transparent",
                    }}
                  >
                    <td style={{ padding: "12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <PosBadge pos={row.posGara} />
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.86)",
                        fontWeight: 700,
                      }}
                    >
                      {row.pilota || "-"}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.86)",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 13,
                      }}
                    >
                      {row.distaccoDalPrimo || "-"}
                    </td>

                    <td
                      style={{
                        padding: "12px",
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <input
                        value={manualDistaccoDraft[row.sourcePosGara] ?? ""}
                        onChange={(e) =>
                          setManualDistaccoDraft((prev) => ({
                            ...prev,
                            [row.sourcePosGara]: e.target.value,
                          }))
                        }
                        placeholder="Es. +12.345 / +1:14.960 / DOPPIATO / DNF / DNFV / BOX / DSQ"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: changed
                            ? "1px solid rgba(160,90,255,0.30)"
                            : "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(0,0,0,0.24)",
                          color: "white",
                          boxSizing: "border-box",
                        }}
                      />

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["DOPPIATO", "DNF", "DNFV", "BOX", "DSQ"].map((label) => (
                          <button
                            key={label}
                            onClick={() =>
                              setManualDistaccoDraft((prev) => ({
                                ...prev,
                                [row.sourcePosGara]: label,
                              }))
                            }
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.16)",
                              background: "rgba(255,255,255,0.08)",
                              color: "white",
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: "uppercase",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowDistaccoModal(false)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        <button
          onClick={resetDistaccoCorrections}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Reset
        </button>

        <button
          onClick={applyDistaccoCorrections}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(160,90,255,0.30)",
            background: "rgba(160,90,255,0.20)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(160,90,255,0.12)",
          }}
        >
          Applica correzioni
        </button>
      </div>
    </div>
  </div>
)}

{showReopenLeagueModal && selectedLeagueToReopen && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          Riapri lega salvata
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Lega selezionata: <b>{selectedLeagueToReopen}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        Scegli quale sprint vuoi riaprire. Verrà ripristinata l’ultima versione salvata di quella lega, completa di penalità e correzioni manuali.
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button
          onClick={() => reopenSavedLeagueSprint(selectedLeagueToReopen, "sprint1")}
          disabled={!currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint1}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,215,0,0.30)",
            background: currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint1
              ? "rgba(255,215,0,0.18)"
              : "rgba(255,255,255,0.06)",
            color: "white",
            cursor: currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint1
              ? "pointer"
              : "not-allowed",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint1 ? 1 : 0.5,
          }}
        >
          Apri Sprint 1
        </button>

        <button
          onClick={() => reopenSavedLeagueSprint(selectedLeagueToReopen, "sprint2")}
          disabled={!currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint2}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint2
              ? "rgba(34,197,94,0.16)"
              : "rgba(255,255,255,0.06)",
            color: "white",
            cursor: currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint2
              ? "pointer"
              : "not-allowed",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            opacity: currentRoundSnapshot?.leagues?.[selectedLeagueToReopen]?.sprint2 ? 1 : 0.5,
          }}
        >
          Apri Sprint 2
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={closeReopenLeagueModal}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>
      </div>
    </div>
  </div>
)}

{showResetLeagueModal && selectedLeagueToReset && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          Resetta lega salvata
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Lega selezionata: <b>{selectedLeagueToReset}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        Stai per cancellare la memoria salvata di questa lega nel round corrente.
        <br /><br />
        Verranno rimossi:
        <br />• Sprint 1 salvata
        <br />• Sprint 2 salvata
        <br />• preview driver/lega collegata
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={closeResetLeagueModal}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Annulla
        </button>

        <button
          onClick={() => resetSpecificLeagueInRound(selectedLeagueToReset)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.30)",
            background: "rgba(239,68,68,0.18)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(239,68,68,0.10)",
          }}
        >
          Conferma reset
        </button>
      </div>
    </div>
  </div>
)}

{showResetAllLeaguesModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          Reset totale leghe del round
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Round selezionato: <b>{currentRound}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        Stai per eliminare tutte le leghe salvate del round corrente.
        <br /><br />
        Verranno rimossi:
        <br />• PRO
        <br />• PRO-AMA
        <br />• AMA
        <br /><br />
        Verrà eliminato anche il round corrente dai salvataggi.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowResetAllLeaguesModal(false)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Annulla
        </button>

        <button
          onClick={resetAllLeaguesInCurrentRound}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.30)",
            background: "rgba(239,68,68,0.18)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(239,68,68,0.10)",
          }}
        >
          Conferma reset totale
        </button>
      </div>
    </div>
  </div>
)}

{showResetAllLeaguesSuccessModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          Reset totale completato
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Tutte le leghe del round corrente sono state eliminate.
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        Premi <b>RESET HARD</b> per tornare alla schermata iniziale.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowResetAllLeaguesSuccessModal(false)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        <button
          onClick={resetAll}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.30)",
            background: "rgba(239,68,68,0.18)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(239,68,68,0.10)",
          }}
        >
          RESET HARD
        </button>
      </div>
    </div>
  </div>
)}

{showResetLeagueSuccessModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          Reset lega completato
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Lega eliminata: <b>{lastResetLeagueName || "-"}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        I dati della lega selezionata sono stati eliminati con successo.
        <br /><br />
        Premi <b>RESET</b> per tornare alla schermata iniziale e reinserire i dati della lega.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowResetLeagueSuccessModal(false)
            setLastResetLeagueName(null)
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        <button
          onClick={resetAll}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(239,68,68,0.30)",
            background: "rgba(239,68,68,0.18)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(239,68,68,0.10)",
          }}
        >
          RESET
        </button>
      </div>
    </div>
  </div>
)}

{showConfirmSaveLeagueModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {pendingSaveLeagueMode === "overwrite"
            ? "Sovrascrivi lega nel round"
            : "Salva lega nel round"}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Lega selezionata: <b>{effectiveLegaResolved || "-"}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        {pendingSaveLeagueMode === "overwrite"
          ? "Stai per sovrascrivere i dati già salvati di questa lega nel round corrente."
          : "Stai per salvare i dati di questa lega nel round corrente."}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowConfirmSaveLeagueModal(false)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Annulla
        </button>

        <button
          onClick={saveOrUpdateCurrentRound}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          Conferma
        </button>
      </div>
    </div>
  </div>
)}

{showSaveLeagueSuccessModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {lastSaveLeagueMode === "overwrite"
            ? "Lega sovrascritta correttamente"
            : "Lega salvata correttamente"}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Lega: <b>{lastSavedLeagueName || "-"}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        {lastSaveLeagueMode === "overwrite"
          ? "I dati della lega sono stati aggiornati correttamente nel round corrente."
          : "I dati della lega sono stati salvati correttamente nel round corrente."}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowSaveLeagueSuccessModal(false)
            setLastSavedLeagueName(null)
            setLastSaveLeagueMode("save")
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}

{showConfirmFinalizeRoundModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {finalizeRoundMode === "overwrite"
            ? "Sovrascrivi Round in classifica"
            : "Salva Round in classifica"}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Round selezionato: <b>R{currentRound}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        {finalizeRoundMode === "overwrite"
          ? "Stai per aggiornare un round già presente in classifica generale con i dati correnti delle tre leghe."
          : "Stai per salvare questo round in classifica generale usando i dati correnti delle tre leghe."}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setShowConfirmFinalizeRoundModal(false)}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Annulla
        </button>

        <button
          onClick={() => {
            finalizeCurrentRound()
            setShowConfirmFinalizeRoundModal(false)
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          {finalizeRoundMode === "overwrite"
            ? "Conferma sovrascrittura"
            : "Conferma salvataggio"}
        </button>
      </div>
    </div>
  </div>
)}

{showSprintSaveSuccessModal && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 560,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          {lastSprintSaveMode === "overwrite"
            ? `Sprint ${lastSavedSprintNumber || "-"} sovrascritta correttamente`
            : `Sprint ${lastSavedSprintNumber || "-"} salvata correttamente`}
        </div>

        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          {lastSprintSaveMode === "overwrite"
            ? "La sprint salvata è stata aggiornata con successo."
            : "La sprint è stata memorizzata con successo."}
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        {lastSprintSaveMode === "overwrite" ? (
          <>
            I dati della <b>Sprint {lastSavedSprintNumber || "-"}</b> sono stati
            sovrascritti correttamente.
          </>
        ) : lastSavedSprintNumber === 1 ? (
          <>
            Hai salvato correttamente la <b>Sprint 1</b>.
            <br /><br />
            Ora puoi caricare i due screen gara della <b>Sprint 2</b> oppure
            chiudere il popup e continuare più tardi.
          </>
        ) : (
          <>
            Hai salvato correttamente la <b>Sprint 2</b>.
            <br /><br />
            Si è generata un’ulteriore tabella chiamata <b>Preview classifica TEAM</b>.
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowSprintSaveSuccessModal(false)
            setLastSavedSprintNumber(null)
            setLastSprintSaveMode("save")
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        {lastSprintSaveMode === "save" && lastSavedSprintNumber === 1 && (
          <button
            onClick={() => {
              setShowSprintSaveSuccessModal(false)
              setLastSavedSprintNumber(null)
              setLastSprintSaveMode("save")
              setPendingSprint2Upload(true)
              fileInputRef.current?.click()
            }}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(34,197,94,0.30)",
              background: "rgba(34,197,94,0.16)",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              boxShadow: "0 0 22px rgba(34,197,94,0.12)",
            }}
          >
            CARICA I DUE FILE DELLA SPRINT 2
          </button>
        )}

        {lastSprintSaveMode === "save" && lastSavedSprintNumber === 2 && (
          <button
            onClick={() => {
              setShowSprintSaveSuccessModal(false)
              setLastSavedSprintNumber(null)
              setLastSprintSaveMode("save")

              requestAnimationFrame(() => {
                teamPreviewRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              })
            }}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(34,197,94,0.30)",
              background: "rgba(34,197,94,0.16)",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              boxShadow: "0 0 22px rgba(34,197,94,0.12)",
            }}
          >
            PROSEGUI
          </button>
        )}

        {lastSprintSaveMode === "overwrite" && (
          <button
            onClick={() => {
              setShowSprintSaveSuccessModal(false)
              setLastSavedSprintNumber(null)
              setLastSprintSaveMode("save")
            }}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "1px solid rgba(34,197,94,0.30)",
              background: "rgba(34,197,94,0.16)",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              boxShadow: "0 0 22px rgba(34,197,94,0.12)",
            }}
          >
            OK
          </button>
        )}
      </div>
    </div>
  </div>
)}

{showRoundChangeConfirmModal && pendingRoundChange && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 580,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 900 }}>
          Cambio Round
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.76 }}>
          Da <b>R{currentRound}</b> a <b>R{pendingRoundChange}</b>
        </div>
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        Stai lasciando un round che contiene dati in lavorazione o non ancora completati.
        <br /><br />
        <b>I dati già salvati non verranno cancellati.</b>
        <br />
        Cambierai solo il round attivo di lavoro.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={cancelRoundChange}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Annulla
        </button>

        <button
          onClick={confirmRoundChange}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,215,0,0.30)",
            background: "rgba(255,215,0,0.18)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(255,215,0,0.10)",
          }}
        >
          Continua e cambia round
        </button>
      </div>
    </div>
  </div>
)}

{showSprintInfo && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>
        INFO per il compilatore
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
  Hai salvato correttamente la Sprint 1
  <br /><br />
  Carica i due screen gara della SPRINT 2
  <br /><br />
  Una volta selezionati i file, il sistema passerà automaticamente alla Sprint 2
</div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowSprintInfo(false)
            setPendingSprint2Upload(false)
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Chiudi
        </button>

        <button
          onClick={() => {
            setPendingSprint2Upload(true)
            fileInputRef.current?.click()
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          CARICA I DUE FILE DELLA SPRINT 2
        </button>
      </div>
    </div>
  </div>
)}

{showSprintResetConfirm && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>
        INFO per il compilatore
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        <b>Reset delle sprint salvate eseguito con successo.</b>
        <br /><br />
        Il sistema è tornato su <b>SPRINT 1</b>.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowSprintResetConfirm(false)

            requestAnimationFrame(() => {
              topPageRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            })
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}

{showSprint2UploadConfirm && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>
        INFO per il compilatore
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        <b>Screen Sprint 2 caricati con successo.</b>
        <br /><br />
        Vai su <b>TAB - GENERA ESTRAZIONE TABELLA</b> per continuare.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowSprint2UploadConfirm(false)

            requestAnimationFrame(() => {
              topPageRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            })
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}

{showSprint2DoneInfo && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(6px)",
      display: "grid",
      placeItems: "center",
      zIndex: 9999,
      padding: 20,
    }}
  >
    <div
      style={{
        width: "100%",
        maxWidth: 520,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "linear-gradient(180deg, rgba(18,22,31,0.98), rgba(8,10,15,0.98))",
        boxShadow: "0 20px 80px rgba(0,0,0,0.55)",
        padding: 22,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900 }}>
        INFO per il compilatore
      </div>

      <div
        style={{
          fontSize: 14,
          lineHeight: 1.55,
          opacity: 0.88,
        }}
      >
        Si è generata un’ulteriore tabella chiamata <b>Preview classifica TEAM</b>.
        <br /><br />
        Prosegui nella pagina per visualizzarla.
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            setShowSprint2DoneInfo(false)

            requestAnimationFrame(() => {
              teamPreviewRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
            })
          }}
          style={{
            padding: "12px 16px",
            borderRadius: 14,
            border: "1px solid rgba(34,197,94,0.30)",
            background: "rgba(34,197,94,0.16)",
            color: "white",
            cursor: "pointer",
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            boxShadow: "0 0 22px rgba(34,197,94,0.12)",
          }}
        >
          PROSEGUI
        </button>
      </div>
    </div>
  </div>
)}

      <div
        style={{
          position: "fixed",
          left: "-20000px",
          top: 0,
          width: 1920,
          height: 1080,
          pointerEvents: "none",
          zIndex: -1,
          opacity: 1,
        }}
      >
        <div ref={exportRef}>
          {finalRows.length > 0 && (
            <div
              style={{
                width: 1920,
                height: 1080,
                boxSizing: "border-box",
                display: "grid",
                gap: 12,
                padding: "10px 18px 12px 18px",
                alignContent: "start",
                borderRadius: 22,
                background:
                  "radial-gradient(1200px 600px at 15% 10%, rgba(255,215,0,0.14), transparent 50%)," +
                  "radial-gradient(900px 500px at 85% 20%, rgba(160,90,255,0.16), transparent 50%)," +
                  "linear-gradient(180deg, #0b0d12 0%, #07080c 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 14px 60px rgba(0,0,0,0.45)",
                overflow: "hidden",
              }}
            >
              <AppHeader
                mainTitle={exportTexts.mainTitle}
                sideLabel={exportTexts.sideLabel}
                subtitle={exportTexts.subtitle}
              />

              <SummaryStrip
  winner={winner}
  bestQuali={bestQuali}
  bestRaceLap={bestRaceLap}
  unionMeta={{ ...unionMeta, gara: normalizedGaraForOutput, lega: effectiveLegaResolved }}
  showMeta={showMeta}
  showLobby={showLobby}
  currentSprint={currentSprint}
  exporting={true}
/>

              <ResultsTable
  previewRows={finalRows}
  bestRaceLap={bestRaceLap}
  unionMeta={{ ...unionMeta, gara: normalizedGaraForOutput, lega: effectiveLegaResolved }}
  prtMode={prtMode}
  unionMode={unionMode}
  currentSprint={currentSprint}
  exporting={true}
  penalties={penalties}
  forceHideMeta={!exportMetaInPng}
  tableTitle={`Classifica Sprint ${currentSprint} definitiva`}
  showTeamInsteadOfAuto={showTeamInsteadOfAutoInSprintTables}
  hideQualifyingColumn={hideQualifyingColumnInCurrentSprint}
  resolveTeamName={(row) => resolveTeamForDisplayRow(row)}
/>
            </div>
          )}
        </div>
      </div>

      {/* ===== EXPORT PNG CLASSIFICA GENERALE TEAM ===== */}
      <div
        style={{
          position: "fixed",
          left: "-24000px",
          top: 0,
          width: 1920,
          height: 1080,
          pointerEvents: "none",
          zIndex: -1,
          opacity: 1,
        }}
      >
        <div ref={teamGeneralExportRef}>
          {championshipTeams.length > 0 && (
            <div
              style={{
                width: 1920,
                height: 1080,
                boxSizing: "border-box",
                display: "grid",
                gap: 14,
                padding: "18px",
                alignContent: "stretch",
                borderRadius: 22,
                background:
                  "radial-gradient(1200px 600px at 15% 10%, rgba(255,215,0,0.14), transparent 50%)," +
                  "radial-gradient(900px 500px at 85% 20%, rgba(160,90,255,0.16), transparent 50%)," +
                  "linear-gradient(180deg, #0b0d12 0%, #07080c 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 14px 60px rgba(0,0,0,0.45)",
                overflow: "hidden",
              }}
            >
              <AppHeader
                mainTitle="BMW M2 TEAM CUP"
                sideLabel="Classifica Generale"
                subtitle="Powered by Albixximo"
              />

              <div
                style={{
                  padding: "16px 18px",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <HeaderBadge
                  label="ROUND ATTUALE"
                  value={`Dati aggiornati dopo Round ${currentRound}`}
                  variant="gold"
                  exporting={true}
                />

                <Separator exporting={true} />

                <HeaderBadge
                  label="TEAM LEADER"
                  value={championshipTeams[0]?.team || "-"}
                  variant="silver"
                  exporting={true}
                />

                <Separator exporting={true} />

                <HeaderBadge
                  label="PUNTI LEADER"
                  value={String(championshipTeams[0]?.total ?? 0)}
                  variant="violet"
                  exporting={true}
                />
              </div>

              <TeamChampionshipTable
  teams={championshipTeams}
  currentRound={currentRound}
  exporting={true}
  title="Classifica Generale TEAM BMW CUP"
  getTeamRoundDetail={getTeamRoundDetail}
/>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}