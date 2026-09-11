import { useOutletContext, Link, useNavigate } from 'react-router';
import { Store } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useCartStore } from '../../store/cartStore';
import { Trash2, Minus, Plus, ArrowRight, ShoppingBag, Image as ImageIcon } from 'lucide-react';
import { StreamxImage } from '../../components/StreamxImage';

export function Cart() {
  const { store } = useOutletContext<{ store: Store }>();
  const { items, removeItem, updateQuantity, getTotal } = useCartStore();
  const navigate = useNavigate();

  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <ShoppingBag className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Seu carrinho está vazio</h2>
        <p className="text-gray-500 mb-8">Parece que você ainda não adicionou nenhum produto ao carrinho.</p>
        <Link
          to={`/${store.slug}`}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          Continuar Comprando
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Carrinho</h1>

      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start">
        <div className="lg:col-span-8">
          <ul className="border-t border-b border-gray-200 divide-y divide-gray-200">
            {items.map((item) => (
              <li key={item.productId} className="flex py-6 sm:py-10">
                <div className="flex-shrink-0 w-32 sm:w-48 aspect-video bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center">
                  {(item as any).image ? (
                    <StreamxImage
                      src={(item as any).image}
                      alt={item.name}
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  )}
                </div>

                <div className="ml-4 flex-1 flex flex-col justify-between sm:ml-6">
                  <div className="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                    <div>
                      <div className="flex justify-between">
                        <h3 className="text-base font-medium text-gray-900">
                          <Link to={`/${store.slug}/p/${item.sku}`} className="hover:text-indigo-600">
                            {item.name}
                          </Link>
                        </h3>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900">{formatCurrency(item.price)}</p>
                      <p className="mt-1 text-sm text-gray-500">SKU: {item.sku || 'N/A'}</p>
                    </div>

                    <div className="mt-4 sm:mt-0 sm:pr-9">
                      <div className="flex items-center border border-gray-300 rounded-lg max-w-[120px]">
                        <button
                          onClick={() => updateQuantity(item.productId, Math.max(1, item.quantity - 1))}
                          className="px-3 py-2 text-gray-600 hover:text-gray-900 focus:outline-none"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 1)}
                          className="w-full text-center border-0 p-0 text-gray-900 focus:ring-0 sm:text-sm"
                        />
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="px-3 py-2 text-gray-600 hover:text-gray-900 focus:outline-none"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="absolute top-0 right-0">
                        <button
                          type="button"
                          onClick={() => removeItem(item.productId)}
                          className="-m-2 p-2 inline-flex text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <span className="sr-only">Remover</span>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Resumo */}
        <div className="mt-16 bg-gray-50 rounded-2xl px-4 py-6 sm:p-6 lg:p-8 lg:mt-0 lg:col-span-4">
          <h2 className="text-lg font-medium text-gray-900">Resumo do pedido</h2>
          
          <dl className="mt-6 space-y-4 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <dt>Subtotal</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(total)}</dd>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <dt className="flex items-center text-sm">
                <span>Frete</span>
              </dt>
              <dd className="font-medium text-gray-900">Calculado no checkout</dd>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <dt className="text-base font-bold text-gray-900">Total a pagar</dt>
              <dd className="text-base font-bold text-gray-900">{formatCurrency(total)}</dd>
            </div>
          </dl>

          <div className="mt-6">
            <button
              onClick={() => navigate(`/${store.slug}/checkout`)}
              className="w-full flex items-center justify-center bg-indigo-600 border border-transparent rounded-xl shadow-sm py-3 px-4 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-50 transition-colors"
            >
              Finalizar Compra
              <ArrowRight className="w-5 h-5 ml-2" />
            </button>
          </div>
          
          <div className="mt-4 text-center">
            <Link to={`/${store.slug}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              ou continuar comprando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
