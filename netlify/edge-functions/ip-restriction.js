export default async (request, context) => {
  const allowedIPs = (Deno.env.get('ALLOWED_IPS') || '').split(',').map(ip => ip.trim()).filter(Boolean);
  
  if (allowedIPs.length === 0) {
    return new Response('Server Configuration Error', { status: 503 });
  }
  
  const clientIP = context.ip;
  
  if (allowedIPs.includes(clientIP)) {
    return context.next();
  }
  
  const html = `<!DOCTYPE html><html lang="ko"><body><h1>🚫 접근 제한</h1><p>IP: ${clientIP}</p></body></html>`;
  return new Response(html, { 
    status: 403, 
    headers: { 'Content-Type': 'text/html; charset=utf-8' } 
  });
};

export const config = { path: "/*" };
