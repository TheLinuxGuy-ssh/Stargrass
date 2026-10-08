/*
 * Builds src/lib/data/stars.json from the HYG star database.
 *
 * Source: https://github.com/astronexus/HYG-Database (hyg/v3/hyg_v38.csv.gz)
 * Licensed CC BY-SA 4.0. The derived star list keeps that licence's
 * attribution requirement, which is why the credit lives in the README.
 *
 * Usage:
 *   curl -L -o scripts/data/hyg.csv.gz \
 *     https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v38.csv.gz
 *   node scripts/build-stars.mjs
 *
 * The catalogue itself is a build input and is not committed. Only the
 * derived JSON is, so the app builds with no network.
 */
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, 'data/hyg.csv.gz');
const OUTPUT = resolve(HERE, '../src/lib/data/stars.json');

/** SPEC.md asks for magnitude 3.0 or brighter. */
const MAGNITUDE_LIMIT = 3.0;

/** The Sun is in the catalogue but is not something a user can look up. */
const EXCLUDED_NAMES = new Set(['Sol']);

function readCsv(text) {
	const rows = [];
	let row = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < text.length; i += 1) {
		const ch = text[i];

		if (quoted) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i += 1;
				} else {
					quoted = false;
				}
			} else {
				field += ch;
			}
			continue;
		}

		if (ch === '"') {
			quoted = true;
		} else if (ch === ',') {
			row.push(field);
			field = '';
		} else if (ch === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (ch !== '\r') {
			field += ch;
		}
	}

	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	const header = rows.shift();
	return rows
		.filter((cells) => cells.length === header.length)
		.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i]])));
}

// Read as bytes. Decoding to a string first corrupts gzip, since arbitrary
// bytes are not valid UTF-8.
const bytes = readFileSync(SOURCE);
const isGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
const text = (isGzip ? gunzipSync(bytes) : bytes).toString('utf8');

const stars = [];
const seen = new Set();

for (const record of readCsv(text)) {
	const name = (record.proper ?? '').trim();
	if (name === '' || EXCLUDED_NAMES.has(name)) continue;

	const magnitude = Number(record.mag);
	const raHours = Number(record.ra);
	const decDeg = Number(record.dec);

	if (!Number.isFinite(magnitude) || magnitude > MAGNITUDE_LIMIT) continue;
	if (!Number.isFinite(raHours) || !Number.isFinite(decDeg)) continue;

	// Two catalogue entries can share a common name. Keep the brighter one.
	const key = name.toLowerCase();
	if (seen.has(key)) {
		const existing = stars.find((s) => s.name.toLowerCase() === key);
		if (existing !== undefined && magnitude < existing.magnitude) {
			existing.magnitude = magnitude;
		}
		continue;
	}
	seen.add(key);

	stars.push({
		name,
		constellation: (record.con ?? '').trim(),
		raHours: Math.round(raHours * 100000) / 100000,
		decDeg: Math.round(decDeg * 100000) / 100000,
		magnitude: Math.round(magnitude * 100) / 100
	});
}

stars.sort((a, b) => a.magnitude - b.magnitude || a.name.localeCompare(b.name));

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(stars, null, '\t') + '\n');

const named = readCsv(text).filter((r) => (r.proper ?? '').trim() !== '').length;
console.log(`Read ${named} named stars from the catalogue.`);
console.log(`Wrote ${stars.length} stars at magnitude ${MAGNITUDE_LIMIT} or brighter.`);
console.log(`Brightest: ${stars.slice(0, 5).map((s) => `${s.name} ${s.magnitude}`).join(', ')}`);
console.log(`Written to ${OUTPUT}`);