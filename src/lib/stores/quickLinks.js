import { derived, get, writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient.js';
import { toast } from '$lib/stores/common.js';
import { buildManageRows, buildTree, flattenRows } from '$lib/utils/quickLinkTree.js';

const TABLE = 'quick_links';

/** quick_links 테이블 전체 행 (display_order 순) */
export const links = writable([]);

export const manageRows = derived(links, ($links) => buildManageRows($links));

export const existingGroups = derived(links, ($links) => [
	...new Set($links.map((l) => l.group_name?.trim()).filter(Boolean))
]);

/** 그룹명 -> 해당 그룹에 이미 존재하는 서브그룹 목록 */
export const subGroupsByGroup = derived(links, ($links) =>
	$links.reduce((acc, l) => {
		const g = l.group_name?.trim();
		const s = l.sub_group_name?.trim();
		if (!g || !s) return acc;
		const list = acc[g] ?? (acc[g] = []);
		if (!list.includes(s)) list.push(s);
		return acc;
	}, {})
);

export async function loadLinks() {
	const { data, error } = await supabase
		.from(TABLE)
		.select('*')
		.order('display_order', { ascending: true });
	if (error) {
		console.error('quick_links load error:', error);
		return;
	}
	links.set(data ?? []);
}

// --- 실시간 동기화 ---
// 본인이 방금 저장한 변경은 이미 로컬에 반영돼 있으므로 되불러오지 않는다.
const SELF_WRITE_WINDOW = 2000;
let lastLocalWriteAt = 0;

function markLocalWrite() {
	lastLocalWriteAt = Date.now();
}

/**
 * 다른 사용자가 링크를 바꾸면 자동으로 다시 불러온다.
 * (Supabase 에서 quick_links 가 supabase_realtime 퍼블리케이션에 포함돼 있어야 동작 — sql/quick-links-setup.sql 참고)
 * @returns 구독 해제 함수
 */
export function subscribeLinks() {
	let timer = null;
	const channel = supabase
		.channel('quick_links_changes')
		.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
			if (Date.now() - lastLocalWriteAt < SELF_WRITE_WINDOW) return;
			// 여러 행이 한꺼번에 바뀌는 경우(순서 변경 등) 마지막 이벤트 기준 한 번만 조회
			clearTimeout(timer);
			timer = setTimeout(loadLinks, 300);
		})
		.subscribe((status) => {
			if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
				console.warn('quick_links 실시간 구독 실패:', status);
			}
		});

	return () => {
		clearTimeout(timer);
		supabase.removeChannel(channel);
	};
}

/** 트리 렌더 순서대로 display_order 를 0..n-1 재부여 (변경된 행만 저장) */
async function persistOrder(ordered) {
	markLocalWrite();
	const changed = ordered.filter((row, i) => row.display_order !== i);
	const reordered = ordered.map((row, i) => ({ ...row, display_order: i }));
	links.set(reordered);
	if (changed.length === 0) return;
	const nextOrder = new Map(reordered.map((l) => [l.id, l.display_order]));
	try {
		await Promise.all(
			changed.map((row) =>
				supabase
					.from(TABLE)
					.update({ display_order: nextOrder.get(row.id) })
					.eq('id', row.id)
			)
		);
	} catch (e) {
		console.error('quick_links reorder error:', e);
	}
}

/** 현재 트리 렌더 순서에 맞춰 display_order 를 다시 맞춘다 */
async function resync() {
	await persistOrder(flattenRows(buildTree(get(links)).tree));
}

export async function addLink({ group_name, sub_group_name, name, path }) {
	markLocalWrite();
	const current = get(links);
	const nextOrder =
		current.length > 0 ? Math.max(...current.map((i) => i.display_order ?? 0)) + 1 : 0;
	const { data, error } = await supabase
		.from(TABLE)
		.insert({ group_name, sub_group_name, name, path, display_order: nextOrder })
		.select()
		.single();
	if (error) {
		console.error('quick_links insert error:', error);
		return false;
	}
	links.set([...current, data]);
	// 새 행이 소속 그룹/서브그룹 블록 안으로 들어오도록 순서 재정렬
	await resync();
	return true;
}

export async function updateLink(id, patch) {
	markLocalWrite();
	const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
	if (error) {
		console.error('quick_links update error:', error);
		return false;
	}
	links.update((rows) => rows.map((l) => (l.id === id ? { ...l, ...patch } : l)));
	// 그룹이 바뀐 경우 렌더 순서와 display_order 를 다시 맞춤
	await resync();
	return true;
}

export async function removeLink(id) {
	markLocalWrite();
	const { error } = await supabase.from(TABLE).delete().eq('id', id);
	if (error) {
		console.error('quick_links delete error:', error);
		return false;
	}
	links.update((rows) => rows.filter((l) => l.id !== id));
	return true;
}

/**
 * 그룹/서브그룹 이름 변경. 소속 행 전체의 group_name / sub_group_name 을 일괄 수정한다.
 * 기존 이름으로 바꾸면 해당 그룹과 자연스럽게 합쳐진다.
 */
export async function renameGroup(node, nextName) {
	markLocalWrite();
	const isGroup = node.kind === 'group';
	const ids = get(links)
		.filter((l) =>
			isGroup
				? l.group_name?.trim() === node.name
				: l.group_name?.trim() === node.groupName && l.sub_group_name?.trim() === node.name
		)
		.map((l) => l.id);
	if (ids.length === 0) return false;

	const patch = isGroup ? { group_name: nextName } : { sub_group_name: nextName };
	const { error } = await supabase.from(TABLE).update(patch).in('id', ids);
	if (error) {
		console.error('quick_links rename error:', error);
		return false;
	}
	links.update((rows) => rows.map((l) => (ids.includes(l.id) ? { ...l, ...patch } : l)));
	// 합쳐진 경우 렌더 순서와 display_order 를 다시 맞춤
	await resync();
	return true;
}

/**
 * 형제 노드끼리 위(-1)/아래(+1) 이동.
 * 그룹/서브그룹 헤더를 옮기면 하위 링크가 통째로 따라간다.
 */
export async function moveNode(path, dir) {
	const { tree } = buildTree(get(links));
	const siblings = path.slice(0, -1).reduce((nodes, i) => nodes[i].children, tree);
	const i = path[path.length - 1];
	const j = i + dir;
	if (j < 0 || j >= siblings.length) return;
	[siblings[i], siblings[j]] = [siblings[j], siblings[i]];
	await persistOrder(flattenRows(tree));
	// 저장 버튼 없이 바로 반영되므로 알려준다
	toast.show('순서가 적용되었습니다.', 'success');
}
