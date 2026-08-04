import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const STORAGE_KEY = 'rimi-tools:favorites';

// 라우트를 kebab-case 로 바꾸기 전에 저장된 경로. 즐겨찾기가 사라지지 않게 옮겨준다.
const RENAMED_PATHS = {
	'/statusboard/devserver': '/status-board/dev-server',
	'/statusboard/stgserver': '/status-board/stg-server',
	'/sentencecompletion/upcoming-deployment-status-form':
		'/sentence-completion/upcoming-deployment-status-form',
	'/sentencecompletion/messenger-form': '/sentence-completion/messenger-form',
	'/sentencecompletion/daily-check-form': '/sentence-completion/daily-check-form'
};

const migrate = (path) => RENAMED_PATHS[String(path).toLowerCase()] ?? path;

function read() {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		if (!Array.isArray(parsed)) return [];
		const migrated = [...new Set(parsed.map(migrate))];
		// 옮긴 결과가 다르면 저장해 두어 다음부터는 변환이 필요 없다
		if (migrated.join('\u0000') !== parsed.join('\u0000')) write(migrated);
		return migrated;
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
