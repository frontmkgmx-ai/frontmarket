export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');
  
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Missing session_id' }), { status: 400 });
  }
  
  try {
    // 1. Consultar Status na Didit (v3 API) usando x-api-key
    const res = await fetch(`https://verification.didit.me/v3/session/${sessionId}/decision/`, {
      headers: { 'x-api-key': env.DIDIT_API_KEY }
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
