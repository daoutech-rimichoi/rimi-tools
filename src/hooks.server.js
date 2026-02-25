/**
 * SvelteKit Server Hooks - IP 제한 기능
 */

import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

/**
 * HTML 특수문자를 이스케이프하여 XSS 공격 방지
 */
function escapeHtml(unsafe) {
	return (unsafe || '')
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	// 빌드 시 또는 정적 자산/시스템 경로 요청 시 스킵
	if (building) {
		return await resolve(event);
	}

	// 허용할 IP 주소 목록
	const allowedIPsEnv = env.ALLOWED_IPS || '';
	const allowedIPs = allowedIPsEnv.split(',').map(ip => ip.trim()).filter(Boolean);
	
	if (allowedIPs.length === 0) {
		return new Response('Server Configuration Error', { status: 503 });
	}

	const clientIP = 
		event.request.headers.get('x-nf-client-connection-ip') ||
		event.getClientAddress() ||
		'unknown';
	
	const isAllowed = allowedIPs.includes(clientIP);
	
	if (isAllowed) {
		return await resolve(event);
	}
	
	const html = `<!DOCTYPE html><html lang="ko"><body><h1>🚫 접근 제한</h1><p>IP: ${escapeHtml(clientIP)}</p></body></html>`;
	return new Response(html, { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
