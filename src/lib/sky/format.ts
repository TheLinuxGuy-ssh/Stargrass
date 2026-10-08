const DIRECTIONS = [
	'N',
	'NNE',
	'NE',
	'ENE',
	'E',
	'ESE',
	'SE',
	'SSE',
	'S',
	'SSW',
	'SW',
	'WSW',
	'W',
	'WNW',
	'NW',
	'NNW'
] as const;

export function compass(azimuth: number): string {
	const normalized = ((azimuth % 360) + 360) % 360;
	return DIRECTIONS[Math.round(normalized / 22.5) % 16];
}

/** One fist at arm's length is about 10 degrees. */
export function fists(altitude: number): number {
	return Math.round((altitude / 10) * 10) / 10;
}

export function formatLocalTime(isoUtc: string, timeZone?: string): string {
	return new Intl.DateTimeFormat(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		timeZone
	}).format(new Date(isoUtc));
}

export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `${rest}m`;
	if (rest === 0) return `${hours}h`;
	return `${hours}h ${rest}m`;
}