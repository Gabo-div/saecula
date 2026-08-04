// gen.mjs — precomputes the General Roman liturgical calendar into compact
// JSON that the Go backend embeds (see ../calendar.go). romcal output for a
// given gregorian year is deterministic, so this runs at build time only —
// never at serve time, keeping a JS runtime out of the Go service.
//
// Usage: npm install && npm run gen   (writes ../data/calendar.<lang>.json)
//
// Range is intentionally a handful of years around the present; fixed saints
// repeat every year but movable feasts and seasons shift, so each year is
// computed in full. Widen YEAR_START/YEAR_END and re-run to cover more.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Romcal } from 'romcal';
import {
  GeneralRoman_En,
  GeneralRoman_Es,
  GeneralRoman_La,
} from '@romcal/calendar.general-roman';

const YEAR_START = 2024;
const YEAR_END = 2030;

// UI language → romcal localized calendar. The app speaks en/es/la.
const LOCALES = {
  en: GeneralRoman_En,
  es: GeneralRoman_Es,
  la: GeneralRoman_La,
};

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'data');

// compact maps a romcal LiturgicalDay to the minimal record the backend
// serves. `sanctoral` is the saints/proper-calendar cycle (the santoral);
// ProperOfTime is the temporal cycle (Sundays, seasons, feasts of the Lord).
function compact(day) {
  // snake_case keys so the Go backend parses the embedded file and serves it
  // through the same struct with no field remapping.
  const rec = {
    id: day.id,
    name: day.name,
    rank: day.rank,
    rank_name: day.rankName,
    colors: day.colors,
    season: day.seasons[0] ?? '',
    season_name: day.seasonNames[0] ?? '',
    holy_day: day.isHolyDayOfObligation,
    optional: day.isOptional,
    sanctoral: day.fromCalendarId !== 'ProperOfTime',
  };
  if (day.titles?.length) rec.titles = day.titles;
  return rec;
}

for (const [lang, localizedCalendar] of Object.entries(LOCALES)) {
  const romcal = new Romcal({ localizedCalendar, scope: 'gregorian' });
  const out = {};
  for (let year = YEAR_START; year <= YEAR_END; year++) {
    const cal = await romcal.generateCalendar(year);
    for (const [date, days] of Object.entries(cal)) {
      out[date] = days.map(compact);
    }
  }
  const path = join(outDir, `calendar.${lang}.json`);
  writeFileSync(path, JSON.stringify(out));
  const dates = Object.keys(out).length;
  console.log(`${lang}: ${dates} dates → ${path}`);
}
