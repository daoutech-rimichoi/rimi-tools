import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient.js';

/**
 * Creates a presence store for real-time user tracking
 * @param {string} roomName - The room/channel name for presence
 * @returns {Object} Presence store with methods
 */
export const createPresenceStore = (roomName) => {
	const presenceState = writable({});
	const currentUser = writable(null);
	let channel = null;

	// Generate a random user ID for anonymous users
	const generateUserId = () => {
		if (browser) {
			let id = sessionStorage.getItem('presence_user_id');
			if (!id) {
				id = 'user_' + Math.random().toString(36).substr(2, 9);
				sessionStorage.setItem('presence_user_id', id);
			}
			return id;
		}
		return 'user_' + Math.random().toString(36).substr(2, 9);
	};

	const join = async (userData = {}) => {
		if (!browser) return;

		const userId = generateUserId();
		const userInfo = {
			id: userId,
			joined_at: new Date().toISOString(),
			editing: null,
			...userData
		};

		currentUser.set(userInfo);

		channel = supabase.channel(roomName, {
			config: {
				presence: {
					key: userId
				}
			}
		});

		channel
			.on('presence', { event: 'sync' }, () => {
				const state = channel.presenceState();
				presenceState.set(state);
			})
			.on('presence', { event: 'join' }, ({ key, newPresences }) => {
			})
			.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
			});

		await channel.subscribe(async (status) => {
			if (status === 'SUBSCRIBED') {
				await channel.track(userInfo);
			}
		});
	};

	const updatePresence = async (updates) => {
		if (!channel || !browser) return;

		const current = get(currentUser);

		if (current) {
			const updated = { ...current, ...updates };
			currentUser.set(updated);
			await channel.track(updated);
		}
	};

	const setEditing = async (fieldName) => {
		await updatePresence({ editing: fieldName, last_active: new Date().toISOString() });
	};

	const clearEditing = async (fieldName) => {
		const current = get(currentUser);
		// Only clear if currently editing this specific field
		if (current && current.editing === fieldName) {
			await updatePresence({ editing: null });
		}
	};

	const leave = async () => {
		if (channel) {
			await channel.untrack();
			await supabase.removeChannel(channel);
			channel = null;
		}
	};

	// Derived store: get all users currently online
	const onlineUsers = derived(presenceState, ($state) => {
		const users = [];
		for (const [key, presences] of Object.entries($state)) {
			if (presences && presences.length > 0) {
				users.push(presences[0]);
			}
		}
		return users;
	});

	// Derived store: get users editing specific fields
	const editingUsers = derived([presenceState, currentUser], ([$state, $currentUser]) => {
		const editing = {};
		const currentUserId = $currentUser?.id;

		for (const [key, presences] of Object.entries($state)) {
			if (presences && presences.length > 0) {
				const user = presences[0];
				// Exclude current user from "someone is editing" display
				// Only show other users who are actively editing a field
				if (user.editing && user.id && user.id !== currentUserId) {
					if (!editing[user.editing]) {
						editing[user.editing] = [];
					}
					editing[user.editing].push(user);
				}
			}
		}

		return editing;
	});

	return {
		presenceState,
		currentUser,
		onlineUsers,
		editingUsers,
		join,
		updatePresence,
		setEditing,
		clearEditing,
		leave
	};
};
