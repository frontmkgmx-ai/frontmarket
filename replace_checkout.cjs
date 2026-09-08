const fs = require('fs');
const content = fs.readFileSync('src/pages/storefront/Checkout.tsx', 'utf8');

const target = `    try {
      const orderData = {
        storeId: store.id,
        customerId: customer.id,
        customerUsername: customer.username,
        items,
        subtotal: total,
        shipping: 0,
        discount: 0,
        total,
        status: 'pending',
        customer: {
          name: customerName || customer.name,
          email: customerEmail || customer.email || '',
          document: customerDoc || customer.cpf,
          phone: customerPhone || customer.phone
        },
        shippingAddress: {
          zipcode,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        },
        paymentMethod: 'pix',
        createdAt: serverTimestamp()
      };

      // 1. Cria pedido na subcoleção de pedidos da loja
      const orderRef = await addDoc(collection(db, 'stores', store.id, 'orders'), orderData);
      
      // 2. Atualiza contador de pedidos do cliente na loja
      try {
        const customerRef = doc(db, 'stores', store.id, 'customers', customer.id);
        await updateDoc(customerRef, {
          totalOrders: increment(1),
          totalSpent: increment(total),
          lastOrderAt: serverTimestamp()
        });
      } catch (custErr) {
        console.warn("Aviso ao atualizar métricas do cliente:", custErr);
      }

      setOrderId(orderRef.id);
      clearCart();
      setSuccess(true);
    } catch (error) {
      console.error("Erro ao finalizar compra:", error);
      alert('Erro ao processar pedido. Tente novamente.');
    }`;

const replacement = `    try {
      const orderPayload = {
        storeId: store.id,
        customerId: customer.id,
        customerUsername: customer.username,
        items,
        subtotal: total,
        total,
        customer: {
          name: customerName || customer.name,
          email: customerEmail || customer.email || '',
          document: customerDoc || customer.cpf,
          phone: customerPhone || customer.phone
        },
        shippingAddress: {
          zipcode,
          street,
          number,
          complement,
          neighborhood,
          city,
          state
        }
      };

      const res = await fetch('/api/checkout/invictuspay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao processar pagamento.');
      }

      setOrderId(data.orderId);
      
      clearCart();
      setSuccess(true);
    } catch (error: any) {
      console.error("Erro ao finalizar compra:", error);
      alert(error.message || 'Erro ao processar pedido. Tente novamente.');
    }`;

const newContent = content.replace(target, replacement);
fs.writeFileSync('src/pages/storefront/Checkout.tsx', newContent);
console.log('Replaced successfully');
