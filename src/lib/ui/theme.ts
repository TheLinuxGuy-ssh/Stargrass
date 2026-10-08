export type Theme = 'dark' | 'red';

const STORAGE_KEY = 'stargrass.theme';

const isBrowser = (): boolean => typeof window !== 'undefined';

export function loadTheme(): Theme {
	if (!isBrowser()) return 'dark';
	return localStorage.getItem(STORAGE_KEY) === 'red' ? 'red' : 'dark';
}

export function saveTheme(theme: Theme): void {
	if (!isBrowser()) return;
	localStorage.setItem(STORAGE_KEY, theme);
	applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
	if (!isBrowser()) return;
	document.documentElement.setAttribute('data-theme', theme);
}