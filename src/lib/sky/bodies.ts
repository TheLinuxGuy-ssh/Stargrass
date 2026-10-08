import * as A from 'astronomy-engine';

export const PLANETS: readonly A.Body[] = [
	A.Body.Mercury,
	A.Body.Venus,
	A.Body.Mars,
	A.Body.Jupiter,
	A.Body.Saturn
];

export interface HorizontalPosition {
	altitude: number;
	azimuth: number;
}

export function horizonOf(body: A.Body, date: Date, obs: A.Observer): HorizontalPosition {
	const eq = A.Equator(body, date, obs, true, true);
	const hor = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
	return { altitude: hor.altitude, azimuth: hor.azimuth };
}

/**
 * Stars come from a J2000 catalog, not from a Body. astronomy-engine only
 * allows eight custom star vectors, so we rotate the catalog vector ourselves.
 */
export function starHorizon(
	raHours: number,
	decDeg: number,
	date: Date,
	obs: A.Observer
): HorizontalPosition {
	const time = A.MakeTime(date);
	const vecJ = A.VectorFromSphere(new A.Spherical(decDeg, raHours * 15, 1), time);
	const vecD = A.RotateVector(A.Rotation_EQJ_EQD(time), vecJ);
	const eq = A.EquatorFromVector(vecD);
	const hor = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
	return { altitude: hor.altitude, azimuth: hor.azimuth };
}

export function magnitude(body: A.Body, date: Date): number | null {
	return A.Illumination(body, date).mag;
}