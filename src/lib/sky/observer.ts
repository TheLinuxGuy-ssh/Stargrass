import * as A from 'astronomy-engine';

export interface Place {
	lat: number;
	lon: number;
	elevation: number;
}

export const observerFor = (place: Place): A.Observer =>
	new A.Observer(place.lat, place.lon, place.elevation);