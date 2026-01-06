export async function handler(event, context) {
	// Get client IP from various possible headers (Netlify provides these)
	const headers = event.headers || {};
	
	// Try multiple sources for real client IP
	const ip =
		headers['x-nf-client-connection-ip'] || // Netlify's IP header
		headers['x-forwarded-for']?.split(',')[0]?.trim() || // Proxy IP (first in chain)
		headers['x-real-ip'] || // Real IP
		headers['cf-connecting-ip'] || // Cloudflare
		context.ip || // Context IP
		'unknown';

	// For debugging: log all headers to see what's available
	console.log('Available headers:', Object.keys(headers));
	console.log('Selected IP:', ip);

	return {
		statusCode: 200,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Headers': 'Content-Type'
		},
		body: JSON.stringify({
			ip: ip,
			userId: ip,
			debug: {
				'x-nf-client-connection-ip': headers['x-nf-client-connection-ip'],
				'x-forwarded-for': headers['x-forwarded-for'],
				'x-real-ip': headers['x-real-ip'],
				'context.ip': context.ip
			}
		})
	};
}
