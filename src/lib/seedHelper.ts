import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateSlug } from './utils';

export interface SeedResult {
  productsCount: number;
  categoriesCount: number;
  ordersCount: number;
  customersCount: number;
}

// 1. Limpa todas as subcoleções da loja para início limpo
export async function clearStoreData(storeId: string): Promise<void> {
  if (!storeId) return;

  const collectionsToClean = ['products', 'categories', 'orders', 'customers', 'coupons', 'activity'];

  for (const collName of collectionsToClean) {
    const snap = await getDocs(collection(db, 'stores', storeId, collName));
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  }
}

// 2. Popula a loja com dados completos e ultra-realistas com fotos em alta qualidade
export async function seedStoreDemoData(storeId: string): Promise<SeedResult> {
  if (!storeId) throw new Error('Store ID é obrigatório');

  // Limpa antes de popular
  await clearStoreData(storeId);

  // A. Categorias
  const categoriesData = [
    { name: 'Moda & Roupas', slug: 'moda-e-roupas', description: 'Vestuário casual, esportivo e urbano com alto padrão.' },
    { name: 'Eletrônicos & Tech', slug: 'eletronicos-e-tech', description: 'Gadgets, periféricos e acessórios inteligentes.' },
    { name: 'Casa & Decoração', slug: 'casa-e-decoracao', description: 'Itens de iluminação, conforto e design minimalista.' },
    { name: 'Cursos & Digitais', slug: 'cursos-e-digitais', description: 'E-books, mentorias e conteúdos digitais instantâneos.' }
  ];

  const categoryIds: { [key: string]: string } = {};

  for (const cat of categoriesData) {
    const catRef = doc(collection(db, 'stores', storeId, 'categories'));
    await setDoc(catRef, {
      ...cat,
      active: true,
      order: 0,
      createdAt: serverTimestamp()
    });
    categoryIds[cat.name] = catRef.id;
  }

  // B. Produtos
  const demoProducts = [
    {
      name: 'Camiseta Oversized Minimalist Preta',
      category: 'Moda & Roupas',
      price: 129.90,
      promotionalPrice: 99.90,
      sku: 'MOD-TSH-001',
      description: 'Camiseta 100% algodão egípcio 260g, corte oversized com caimento estruturado e costuras reforçadas.',
      images: [
        'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 45,
      active: true,
      isDigital: false,
      weight: 0.35
    },
    {
      name: 'Jaqueta Corta-Vento Street Tech',
      category: 'Moda & Roupas',
      price: 289.00,
      promotionalPrice: 249.00,
      sku: 'MOD-JKT-002',
      description: 'Jaqueta impermeável com capuz ajustável e detalhes reflexivos para máxima proteção com estilo.',
      images: [
        'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 20,
      active: true,
      isDigital: false,
      weight: 0.6
    },
    {
      name: 'Headphone Wireless Pro Noise Cancelling',
      category: 'Eletrônicos & Tech',
      price: 499.00,
      promotionalPrice: 399.00,
      sku: 'TECH-AUD-001',
      description: 'Cancelamento ativo de ruído inteligente, drivers de 40mm e autonomia estendida de 40 horas contínuas.',
      images: [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 18,
      active: true,
      isDigital: false,
      weight: 0.45
    },
    {
      name: 'Smartwatch Série 8 Ultra Edition',
      category: 'Eletrônicos & Tech',
      price: 379.00,
      promotionalPrice: 299.90,
      sku: 'TECH-WAT-002',
      description: 'Monitor cardíaco, oxigenação no sangue, GPS integrado e display AMOLED com mais de 100 modos de treino.',
      images: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 32,
      active: true,
      isDigital: false,
      weight: 0.25
    },
    {
      name: 'Luminária de Mesa LED Sunset Atmosphere',
      category: 'Casa & Decoração',
      price: 159.00,
      promotionalPrice: 129.00,
      sku: 'HOME-LGT-001',
      description: 'Projetor de luz pôr-do-sol em lente óptica de cristal com controle de intensidade e 16 opções cromáticas.',
      images: [
        'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 25,
      active: true,
      isDigital: false,
      weight: 0.5
    },
    {
      name: 'Caneca Térmica Inox Ceramic 500ml',
      category: 'Casa & Decoração',
      price: 89.90,
      sku: 'HOME-MUG-002',
      description: 'Revestimento interno cerâmico que preserva o sabor, conserva bebidas geladas por 12h e quentes por 6h.',
      images: [
        'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 50,
      active: true,
      isDigital: false,
      weight: 0.3
    },
    {
      name: 'E-book: Guia do E-commerce de Alto Desempenho',
      category: 'Cursos & Digitais',
      price: 47.00,
      sku: 'DIG-EBK-001',
      description: 'Manual definitivo com estratégias comprovadas de conversão, anúncios eficientes e retenção de clientes.',
      images: [
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80'
      ],
      stock: 9999,
      active: true,
      isDigital: true,
      weight: 0
    }
  ];

  const createdProducts: any[] = [];

  for (const prod of demoProducts) {
    const prodRef = doc(collection(db, 'stores', storeId, 'products'));
    const prodData = {
      name: prod.name,
      slug: generateSlug(prod.name),
      description: prod.description,
      price: prod.price,
      promotionalPrice: prod.promotionalPrice || null,
      sku: prod.sku,
      categoryId: categoryIds[prod.category] || '',
      stock: prod.stock,
      active: prod.active,
      isDigital: prod.isDigital,
      images: prod.images,
      weight: prod.weight,
      createdAt: serverTimestamp()
    };
    await setDoc(prodRef, prodData);
    createdProducts.push({ id: prodRef.id, ...prodData });
  }

  // C. Clientes de Demonstração
  const demoCustomers = [
    {
      name: 'Lucas Silva Costa',
      email: 'lucas.silva@exemplo.com.br',
      phone: '(11) 98765-4321',
      document: '123.456.789-00',
      address: {
        zipcode: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP'
      }
    },
    {
      name: 'Mariana Oliveira Santos',
      email: 'mariana.oliveira@exemplo.com.br',
      phone: '(21) 99876-5432',
      document: '234.567.890-11',
      address: {
        zipcode: '22041-001',
        street: 'Avenida Atlântica',
        number: '500',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ'
      }
    },
    {
      name: 'Rafael Mendes Rocha',
      email: 'rafael.rocha@exemplo.com.br',
      phone: '(31) 97654-3210',
      document: '345.678.901-22',
      address: {
        zipcode: '30140-071',
        street: 'Rua da Bahia',
        number: '1200',
        neighborhood: 'Lourdes',
        city: 'Belo Horizonte',
        state: 'MG'
      }
    }
  ];

  const customerIds: string[] = [];

  for (const cust of demoCustomers) {
    const custRef = doc(collection(db, 'stores', storeId, 'customers'));
    await setDoc(custRef, {
      name: cust.name,
      email: cust.email,
      phone: cust.phone,
      document: cust.document,
      address: cust.address,
      totalOrders: 1,
      createdAt: serverTimestamp()
    });
    customerIds.push(custRef.id);
  }

  // D. Pedidos de Demonstração
  const statuses = ['delivered', 'shipped', 'processing', 'pending'] as const;

  for (let i = 0; i < demoCustomers.length; i++) {
    const customer = demoCustomers[i];
    const product = createdProducts[i % createdProducts.length];
    const orderRef = doc(collection(db, 'stores', storeId, 'orders'));

    const itemPrice = product.promotionalPrice || product.price;
    const subtotal = itemPrice * 1;
    const total = subtotal;

    await setDoc(orderRef, {
      storeId,
      customerId: customerIds[i],
      items: [
        {
          productId: product.id,
          name: product.name,
          price: itemPrice,
          quantity: 1,
          sku: product.sku
        }
      ],
      subtotal,
      shipping: 0,
      discount: 0,
      total,
      status: statuses[i % statuses.length],
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document
      },
      shippingAddress: customer.address,
      paymentMethod: 'pix',
      createdAt: serverTimestamp()
    });
  }

  return {
    productsCount: demoProducts.length,
    categoriesCount: categoriesData.length,
    ordersCount: demoCustomers.length,
    customersCount: demoCustomers.length
  };
}
