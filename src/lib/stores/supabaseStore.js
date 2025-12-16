import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient.js';

/**
 * Creates a writable store that syncs with Supabase (수동 저장, 공유 데이터, 인증 불필요)
 * @param {string} key - The key to store in Supabase
 * @param {string} startValue - Initial value
 * @returns {{subscribe: Function, set: Function, update: Function, load: Function, save: Function}}
 */
export const createSupabaseStore = (key, startValue) => {
	const store = writable(startValue);

	const load = async () => {
		if (!browser) return;
		
		try {
			const { data, error } = await supabase
				.from('deployment_form_data')
				.select('value')
				.eq('key', key)
				.single();

			if (error && error.code !== 'PGRST116') {
				console.error(`Error loading ${key}:`, error);
				return false;
			} else if (data) {
				store.set(data.value);
			}
			return true;
		} catch (err) {
			console.error(`Failed to load ${key}:`, err);
			return false;
		}
	};

	const save = async () => {
		if (!browser) return false;
		
		let currentValue;
		store.subscribe(value => currentValue = value)();

		try {
			const { error } = await supabase
				.from('deployment_form_data')
				.upsert({ key, value: currentValue, updated_at: new Date().toISOString() }, { onConflict: 'key' });

			if (error) {
				console.error(`Error saving ${key}:`, error);
				return false;
			}
			return true;
		} catch (err) {
			console.error(`Failed to save ${key}:`, err);
			return false;
		}
	};

	if (browser) {
		// 초기 로드
		load();

		// Subscribe to real-time updates from Supabase
		const channel = supabase
			.channel(`deployment_form_data:${key}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'deployment_form_data',
					filter: `key=eq.${key}`
				},
				(payload) => {
					if (payload.new && payload.new.value !== undefined) {
						store.set(payload.new.value);
					}
				}
			)
			.subscribe();
	}

	return {
		subscribe: store.subscribe,
		set: store.set,
		update: store.update,
		load,
		save
	};
};
