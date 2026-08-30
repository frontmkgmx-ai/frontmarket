export async function onRequestPost(context) {
  const { request, env } = context;
  
  let uid = "unknown";
  
  try {
    const body = await request.json();
    if (body.uid) uid = body.uid;
  } catch (e) {
    // Ignore
  }
  
  // 1. Validar variáveis de ambiente
  if (!env.DIDIT_API_KEY) {
    const availableKeys = Object.keys(env || {}).join(', ');
    return new Response(JSON.stringify({ 
      error: 'DIDIT_API_KEY (client_secret) not configured in Cloudflare Pages Settings.',
      debug_keys_found: availableKeys
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const clientId = env.DIDIT_CLIENT_ID || '07398999-897d-4bc3-b246-5a4ae4857162';
  const workflowId = env.DIDIT_WORKFLOW_ID || '6b43db1f-9cb7-48f1-a0a7-1941464fb1ca';

  try {
    // 2. Obter Token Bearer (OAuth2)
    const tokenResponse = await fetch('https://auth.didit.me/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: env.DIDIT_API_KEY,
        grant_type: 'client_credentials',
        scope: 'openid'
      }).toString()
    });

    const tokenText = await tokenResponse.text();
    let tokenData;
    try {
      tokenData = JSON.parse(tokenText);
    } catch (e) {
      throw new Error(`Erro ao parsear token da Didit: ${tokenText}`);
    }

    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(`Didit Auth Error (${tokenResponse.status}): ${tokenData.error_description || tokenData.error || tokenText}`);
    }

    const accessToken = tokenData.access_token;

    // 3. Criar a sessão de verificação KYC (v1 API)
    const sessionResponse = await fetch('https://api.didit.me/v1/sessions/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: uid,
        callback: `${env.APP_URL || 'https://frontmarket.cysmk.online'}/admin/verification?session_id={session_id}`,
        callback_method: 'both'
      })
    });
    
    const sessionText = await sessionResponse.text();
    if (!sessionText) {
      throw new Error(`Resposta vazia do servidor Didit Sessions (status: ${sessionResponse.status})`);
    }

    let session;
    try {
      session = JSON.parse(sessionText);
    } catch (e) {
      throw new Error(`Resposta inválida do servidor Didit Sessions: ${sessionText}`);
    }

    if (!sessionResponse.ok) {
      throw new Error(`Didit API error: ${sessionResponse.status} ${session.message || session.detail || sessionText}`);
    }

    // A resposta v1 da Didit geralmente retorna a URL direto em session.url ou session.session_url
    const verificationUrl = session.url || session.session_url;
    const sessionId = session.session_id || session.id;

    if (!verificationUrl) {
      throw new Error(`URL de verificação não encontrada no payload: ${JSON.stringify(session)}`);
    }

    return new Response(JSON.stringify({ 
      verification_url: verificationUrl, 
      session_id: sessionId 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Erro interno ao iniciar KYC' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
