import { writable } from 'svelte/store';

const EMPTY = { show: false, message: '', type: 'success' };

// 앱 전역 토스트. 페이지마다 따로 만들지 말고 이걸 쓴다.
function createToastStore() {
	const { subscribe, set } = writable(EMPTY);
	let timer = null;

	return {
		subscribe,
		/** @param {string} message @param {'success'|'error'|'info'} type @param {number} duration */
		show: (message, type = 'success', duration = 2500) => {
			// 이전 타이머를 정리하지 않으면 연속 호출 시 새 토스트가 일찍 사라진다
			clearTimeout(timer);
			set({ show: true, message, type });
			timer = setTimeout(() => set(EMPTY), duration);
		}
	};
}

export const toast = createToastStore();
