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

  const workflowId = env.DIDIT_WORKFLOW_ID || '6b43db1f-9cb7-48f1-a0a7-1941464fb1ca';

  try {
    // 2. Criar a sessão de verificação KYC (v3 API)
    const sessionResponse = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.DIDIT_API_KEY
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

    // A resposta v3 da Didit retorna url na raiz
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
