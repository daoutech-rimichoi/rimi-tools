/**
 * quick_links 테이블 행을 3단 트리(그룹 > 서브그룹 > 링크)로 다루는 순수 함수 모음.
 * DB 접근은 $lib/stores/quickLinks.js 가 담당한다.
 */

/**
 * DB 행 → 3단 트리.
 * group_name 없음 = 단독(직접 이동), sub_group_name 없음 = 그룹 직속 링크.
 * 한 그룹 안에 직속 링크와 서브그룹이 섞일 수 있고, 등록 순서대로 배치된다.
 */
export function buildTree(rows) {
	const tree = [];
	const groupAt = new Map(); // 그룹명 -> tree 인덱스
	const subAt = new Map(); // `그룹\0서브` -> 그룹 children 인덱스
	for (const row of rows) {
		const g = row.group_name?.trim();
		const s = row.sub_group_name?.trim();
		const leaf = { type: 'link', row };
		if (!g) {
			tree.push(leaf);
			continue;
		}
		if (!groupAt.has(g)) {
			groupAt.set(g, tree.length);
			tree.push({ type: 'group', name: g, children: [] });
		}
		const children = tree[groupAt.get(g)].children;
		if (!s) {
			children.push(leaf);
			continue;
		}
		const key = `${g}\u0000${s}`;
		if (!subAt.has(key)) {
			subAt.set(key, children.length);
			children.push({ type: 'sub', name: s, children: [] });
		}
		children[subAt.get(key)].children.push(leaf);
	}
	return { tree, groupAt };
}

/**
 * 트리 + 특수 항목을 사이드바 렌더 구조로 조립 (items 가 있으면 하위 메뉴).
 * specialItems 는 코드에서 유지하는 동작 항목(일감 번호 입력 프롬프트 등)이며,
 * 같은 이름의 그룹이 있으면 해당 그룹의 DB 링크 뒤에 병합된다.
 */
export function buildQuickLinks(rows, specialItems = {}) {
	const { tree, groupAt } = buildTree(rows);
	const toView = (node) =>
		node.type === 'link'
			? { name: node.row.name, path: node.row.path }
			: { name: node.name, items: node.children.map(toView) };
	const result = tree.map(toView);
	for (const [g, items] of Object.entries(specialItems)) {
		if (groupAt.has(g)) {
			result[groupAt.get(g)].items.push(...items);
		} else {
			result.push({ name: g, items: [...items] });
		}
	}
	return result;
}

/** 트리 렌더 순서대로 행을 펼침 (display_order 재부여 기준) */
export function flattenRows(tree) {
	const out = [];
	const walk = (nodes) => {
		for (const node of nodes) {
			if (node.type === 'link') out.push(node.row);
			else walk(node.children);
		}
	};
	walk(tree);
	return out;
}

/**
 * 링크 관리 목록용 평면 행 (그룹/서브그룹 헤더 + 들여쓰기 depth + 순서이동 path).
 * groupName = 소속 그룹명(서브그룹 이름 변경 시 대상 행을 좁히는 데 사용)
 */
export function buildManageRows(rows) {
	const { tree } = buildTree(rows);
	const out = [];
	const walk = (nodes, depth, parentPath, groupName) => {
		nodes.forEach((node, i) => {
			const path = [...parentPath, i];
			const meta = { depth, path, index: i, siblings: nodes.length, groupName };
			if (node.type === 'link') {
				out.push({ kind: 'link', row: node.row, ...meta });
			} else {
				const ownGroup = node.type === 'group' ? node.name : groupName;
				out.push({ kind: node.type, name: node.name, ...meta, groupName: ownGroup });
				walk(node.children, depth + 1, path, ownGroup);
			}
		});
	};
	walk(tree, 0, [], null);
	return out;
}

/** 커맨드 팔레트용: 모든 링크를 "그룹 > 서브그룹" 경로와 함께 평면화 */
export function flattenForSearch(rows) {
	return rows
		.filter((row) => row.path)
		.map((row) => ({
			name: row.name,
			path: row.path,
			group: [row.group_name?.trim(), row.sub_group_name?.trim()].filter(Boolean).join(' › ')
		}));
}
