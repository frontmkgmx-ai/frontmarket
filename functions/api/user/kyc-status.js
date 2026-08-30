export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), { status: 400 });
  }

  const clientId = env.DIDIT_CLIENT_ID || '07398999-897d-4bc3-b246-5a4ae4857162';
  
  try {
    // 1. Obter Token Bearer (OAuth2 via client_credentials)
    const tokenResponse = await fetch('https://auth.didit.me/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: env.DIDIT_API_KEY,
        grant_type: 'client_credentials',
        scope: 'openid'
      }).toString()
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.error || 'Falha ao autenticar na Didit');

    // 2. Consultar Status na Didit (v1 API)
    const res = await fetch(`https://api.didit.me/v1/sessions/${sessionId}/decision/`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
