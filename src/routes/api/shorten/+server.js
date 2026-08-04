import { json } from '@sveltejs/kit';

/**
 * URL 단축 프록시.
 *
 * 예전에는 netlify/functions/shorten.js 였는데, 그러면 `npm run dev` 로 띄웠을 때
 * 함수가 없어 404 가 나서 버튼이 항상 실패했다. SvelteKit 엔드포인트로 두면
 * 로컬(`npm run dev`)과 배포(adapter-netlify 가 함수로 변환) 양쪽에서 동작한다.
 */
const SHORTENER_URL = 'https://rul.kr/create';

// 루트 레이아웃의 prerender=true 를 상속하지 않도록 명시한다.
export const prerender = false;

export async function POST({ request, fetch }) {
	let url;
	try {
		({ url } = await request.json());
	} catch {
		return json({ error: '잘못된 요청입니다.' }, { status: 400 });
	}

	if (!url || typeof url !== 'string') {
		return json({ error: '단축할 URL이 없습니다.' }, { status: 400 });
	}

	try {
		const res = await fetch(SHORTENER_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ url, type: 'public' })
		});

		const data = await res.json().catch(() => null);
		if (!res.ok || !data?.short_url) {
			return json(
				{ error: data?.error ?? `단축 서비스 응답 오류 (${res.status})` },
				{ status: 502 }
			);
		}
		return json({ result_url: data.short_url });
	} catch (e) {
		console.error('URL 단축 실패:', e);
		return json({ error: '단축 서비스에 연결할 수 없습니다.' }, { status: 502 });
	}
}
