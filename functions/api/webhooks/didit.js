export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { event_type, session_id, vendor_data, status, data } = body;
    const timestamp = new Date().toISOString();

    await context.env.DIDIT_EVENTS.put(
      `event:${session_id}:${timestamp}`,
      JSON.stringify({ event_type, session_id, vendor_data, status, data, received_at: timestamp })
    );

    // Atualiza status atual do usuário
    if (event_type === 'status.updated' || event_type === 'user.status.updated') {
      await context.env.DIDIT_EVENTS.put(
        `user:${vendor_data}:status`,
        JSON.stringify({ status, session_id, updated_at: timestamp })
      );
      
      // Salva no Firebase Realtime DB (conforme sugerido)
      try {
        const firebaseProject = context.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0736685342';
        await fetch(`https://${firebaseProject}-default-rtdb.firebaseio.com/kyc/${vendor_data}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, session_id, updated_at: timestamp })
        });
      } catch (e) {
        console.error('Erro ao salvar no Firebase:', e);
      }
    }

    if (event_type === 'data.updated' || event_type === 'user.data.updated') {
      const existing = await context.env.DIDIT_EVENTS.get(`user:${vendor_data}:status`);
      const parsed = existing ? JSON.parse(existing) : {};
      await context.env.DIDIT_EVENTS.put(
        `user:${vendor_data}:status`,
        JSON.stringify({ ...parsed, document_data: data?.decision?.kyc?.document_data, updated_at: timestamp })
      );
    }

    if (event_type === 'business.status.updated' || event_type === 'business.data.updated') {
      await context.env.DIDIT_EVENTS.put(
        `business:${vendor_data}:status`,
        JSON.stringify({ status, data, updated_at: timestamp })
      );
    }

    if (
      event_type === 'transaction.created' ||
      event_type === 'transaction.status.updated' ||
      event_type === 'travel_rule.status.updated' ||
      event_type === 'workflow.compliance_changed' ||
      event_type === 'activity.created'
    ) {
      await context.env.DIDIT_EVENTS.put(
        `activity:${vendor_data}:${timestamp}`,
        JSON.stringify({ event_type, data, updated_at: timestamp })
      );
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const vendorData = url.searchParams.get('vendor_data');
  const sessionId = url.searchParams.get('session_id');

  if (vendorData) {
    const result = await context.env.DIDIT_EVENTS.get(`user:${vendorData}:status`);
    return new Response(result || '{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (sessionId) {
    const keys = await context.env.DIDIT_EVENTS.list({ prefix: `event:${sessionId}:` });
    const events = await Promise.all(
      keys.keys.map(async k => {
        const val = await context.env.DIDIT_EVENTS.get(k.name);
        return val ? JSON.parse(val) : null;
      })
    );
    return new Response(JSON.stringify(events.filter(Boolean)), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Provide vendor_data or session_id' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-didit-signature, Authorization'
    }
  });
}
