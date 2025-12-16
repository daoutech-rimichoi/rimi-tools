import {writable} from 'svelte/store';
import {USER_NAMES} from '$lib/config/users.js';

export const personnel = writable(USER_NAMES);

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
