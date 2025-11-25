import {writable} from 'svelte/store';

export const personnel = writable([
    '최경림',
    '김준혁',
    '김지웅',
    '전하라',
    '오용상',
    '배윤희',
    '한수찬'
]);

// 토스트 메시지를 위한 store
function createToastStore() {
    const {subscribe, set} = writable({
        show: false,
        message: '',
        type: 'success' // 'success', 'error', 'info'
    });

    return {
        subscribe,
        show: (message, type = 'success', duration = 2000) => {
            set({show: true, message, type});
            setTimeout(() => {
                set({show: false, message: '', type: 'success'});
            }, duration);
        }
    };
}

export const toast = createToastStore();
