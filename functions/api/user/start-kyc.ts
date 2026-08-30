export async function onRequestPost(context: any) {
  const { request, env } = context;
  
  let uid = "unknown";
  
  try {
    const body = await request.json();
    if (body.uid) uid = body.uid;
  } catch (e) {
    // Ignore
  }
  
  if (!env.DIDIT_API_KEY) {
    return new Response(JSON.stringify({ error: 'DIDIT_API_KEY not configured in Cloudflare.' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch('https://verification.didit.me/v3/session/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.DIDIT_API_KEY
      },
      body: JSON.stringify({
        workflow_id: env.DIDIT_WORKFLOW_ID || '6b43db1f-9cb7-48f1-a0a7-1941464fb1ca',
        vendor_data: uid,
        callback: `${env.APP_URL || 'https://frontmarket.cysmk.online'}/admin/verification/result`
      })
    });
    
    if (!response.ok) {
      const errBody = await response.text();
      return new Response(JSON.stringify({ error: `Didit API error: ${response.status} ${errBody}` }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const text = await response.text();
    if (!text) {
      throw new Error(`Resposta vazia do servidor Didit (status: ${response.status})`);
    }

    let session;
    try {
      session = JSON.parse(text);
    } catch (e) {
      throw new Error(`Resposta inválida do servidor Didit: ${text}`);
    }

    return new Response(JSON.stringify({ verification_url: session.url, session_id: session.session_id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Erro interno ao iniciar KYC' }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
