import * as A from 'astronomy-engine';

export interface MoonResult {
	phaseName: string;
	illuminationPct: number;
	riseUtc: string | null;
	setUtc: string | null;
	nextNewMoonUtc: string | null;
	aboveHorizon: boolean;
}

const PHASE_NAMES = [
	'New Moon',
	'Waxing Crescent',
	'First Quarter',
	'Waxing Gibbous',
	'Full Moon',
	'Waning Gibbous',
	'Last Quarter',
	'Waning Crescent'
] as const;

/** MoonPhase returns 0 new, 90 first quarter, 180 full, 270 last quarter. */
export function phaseName(phaseDegrees: number): string {
	const index = Math.round((((phaseDegrees % 360) + 360) % 360) / 45) % 8;
	return PHASE_NAMES[index];
}

export function moonResult(obs: A.Observer, from: Date): MoonResult {
	const eq = A.Equator(A.Body.Moon, from, obs, true, true);
	const hor = A.Horizon(from, obs, eq.ra, eq.dec, 'normal');

	const rise = A.SearchRiseSet(A.Body.Moon, obs, +1, from, 1);
	const set = A.SearchRiseSet(A.Body.Moon, obs, -1, from, 1);
	const nextNew = A.SearchMoonPhase(0, from, 40);

	return {
		phaseName: phaseName(A.MoonPhase(from)),
		illuminationPct: Math.round(A.Illumination(A.Body.Moon, from).phase_fraction * 100),
		riseUtc: rise === null ? null : rise.date.toISOString(),
		setUtc: set === null ? null : set.date.toISOString(),
		nextNewMoonUtc: nextNew === null ? null : nextNew.date.toISOString(),
		aboveHorizon: hor.altitude > 0
	};
}