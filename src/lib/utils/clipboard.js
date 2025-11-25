// src/lib/utils/clipboard.js
import {toast} from '$lib/stores/common.js';

export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.show('클립보드에 복사되었습니다.', 'success');
        return true;
    } catch (err) {
        console.error('클립보드 복사 실패:', err);
        toast.show('클립보드 복사에 실패했습니다.', 'error');
        return false;
    }
};
