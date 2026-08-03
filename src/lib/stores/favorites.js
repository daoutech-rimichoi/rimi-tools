import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rimi-tools:favorites';

function read() {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function write(paths) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
}

function createFavoriteStore() {
	const { subscribe, update, set } = writable(read());

	return {
		subscribe,
		/** 서버 렌더 직후 클라이언트 값으로 맞춘다 */
		hydrate: () => set(read()),
		toggle: (path) =>
			update((paths) => {
				const next = paths.includes(path) ? paths.filter((p) => p !== path) : [...paths, path];
				write(next);
				return next;
			})
	};
}

export const favorites = createFavoriteStore();
