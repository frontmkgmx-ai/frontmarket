import React from 'react';
import { ShoppingBag, Menu, LogOut, Loader2 } from 'lucide-react';
import { STORE_THEMES } from '../lib/themes';

interface StorefrontPreviewProps {
  storeName: string;
  themeId: string;
  logoUrl: string;
  headerStyle: string;
  footerStyle: string;
  loadingStyle: string;
  pdpStyle?: string;
}

export function StorefrontPreview({ storeName, themeId, logoUrl, headerStyle, footerStyle, loadingStyle, pdpStyle = 'default' }: StorefrontPreviewProps) {
  const currentTheme = STORE_THEMES.find(t => t.id === themeId) || STORE_THEMES[0];
  const [viewMode, setViewMode] = React.useState<'home' | 'pdp'>('home');
  const themeColor = currentTheme.colors.primary.split('text-')[1] || 'indigo-600'; // fallback
  
  // Helpers para o preview
  const getHeaderLayout = () => {
    switch (headerStyle) {
      case 'centered':
        return 'flex-col items-center justify-center gap-2';
      case 'minimalist':
        return 'justify-between py-2 border-b-0';
      case 'topnav':
        return 'justify-between py-1 bg-slate-900 text-white';
      case 'dualnav':
        return 'justify-between py-3 border-b-4 border-indigo-600';
      case 'sticky':
        return 'justify-between py-3 shadow-lg';
      case 'floating':
        return 'justify-between py-2 px-4 m-2 rounded-full border border-slate-200/50 shadow-md';
      case 'appstyle':
        return 'justify-between py-4 border-b-0 shadow-sm';
      case 'logoright':
        return 'flex-row-reverse justify-between';
      case 'compact':
        return 'justify-between py-1.5';
      default:
        return 'justify-between py-3';
    }
  };

  const getFooterLayout = () => {
    switch (footerStyle) {
      case 'dark':
        return 'bg-slate-900 text-slate-400 border-slate-800';
      case 'minimalist':
        return 'py-4 opacity-60 text-center border-t-0';
      case 'multicolumn':
        return 'py-8 text-left border-t-2 border-slate-100';
      case 'centered':
        return 'py-6 text-center';
      case 'banner':
        return 'py-6 bg-indigo-50 text-indigo-900 border-t-4 border-indigo-500';
      case 'floating':
        return 'm-4 rounded-2xl border shadow-lg py-4 text-center';
      case 'fixed':
        return 'py-4 text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]';
      case 'modernlight':
        return 'py-8 bg-slate-50 text-slate-500 rounded-t-3xl border-t border-slate-200';
      case 'appbar':
        return 'py-2 flex justify-around items-center border-t shadow-inner text-[10px]';
      default:
        return 'py-6 text-center opacity-70 border-t border-slate-200/50';
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 p-2 sm:p-4 rounded-xl">
      {/* Switch View Tabs */}
      <div className="flex bg-slate-300/80 p-1 rounded-lg mb-3 text-[11px] font-semibold gap-1 z-10 shadow-xs">
        <button 
          type="button"
          onClick={() => setViewMode('home')}
          className={`px-3 py-1 rounded-md transition-all ${viewMode === 'home' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
        >
          Início
        </button>
        <button 
          type="button"
          onClick={() => setViewMode('pdp')}
          className={`px-3 py-1 rounded-md transition-all ${viewMode === 'pdp' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-800'}`}
        >
          Página de Produto
        </button>
      </div>

      {/* Phone Frame */}
      <div className="relative w-full max-w-[375px] h-[667px] bg-white rounded-[2.5rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden flex flex-col shrink-0">
        
        {/* Notch */}
        <div className="absolute top-0 inset-x-0 h-6 bg-slate-800 rounded-b-2xl mx-auto w-40 z-50"></div>
        
        {/* Inner Content using Theme */}
        <div className={`flex-1 flex flex-col w-full h-full overflow-y-auto ${currentTheme.colors.background} ${currentTheme.colors.text} ${currentTheme.fontFamily} text-xs pt-6`}>
          
          {/* Header */}
          <header className={`px-4 z-30 bg-opacity-95 backdrop-blur-sm ${currentTheme.colors.surface} ${getHeaderLayout()}`}>
            <div className={`flex items-center gap-2 ${headerStyle === 'centered' ? 'w-full justify-center flex-col' : 'w-full justify-between'}`}>
              <div className="font-bold truncate max-w-[120px]" style={{ color: currentTheme.colors.primary }}>
                {logoUrl ? <img src={logoUrl} alt={storeName} className="h-6 object-contain" /> : storeName}
              </div>
              <div className="flex items-center gap-2">
                <Menu className="w-4 h-4" />
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
          </header>

          {/* Main Body Preview */}
          <main className="flex-1 p-4 space-y-4">
            {viewMode === 'home' ? (
              <>
                <div className="w-full h-24 rounded-xl bg-slate-100 flex flex-col items-center justify-center border border-slate-200 shadow-inner">
                   <Loader2 className="w-5 h-5 animate-spin text-indigo-500 mb-1" />
                   <span className="text-[10px] text-slate-500 font-medium">Loading: {loadingStyle}</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[1, 2, 3, 4].map(n => (
                    <div key={n} className="rounded-xl bg-white border border-slate-200/80 p-2 shadow-2xs space-y-1.5">
                      <div className="aspect-video bg-slate-100 rounded-lg"></div>
                      <div className="h-2.5 bg-slate-200 rounded-full w-3/4"></div>
                      <div className="h-2 bg-indigo-200 rounded-full w-1/2"></div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* PDP Preview Mode */
              <div className={`space-y-3 ${pdpStyle === 'centered' ? 'text-center' : ''} ${pdpStyle === 'minimalist' ? 'border-0' : ''}`}>
                <div className={`aspect-video rounded-2xl bg-slate-100 border border-slate-200/80 overflow-hidden relative ${pdpStyle === 'fullwidth' ? '-mx-4 rounded-none' : ''}`}>
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 font-medium">
                    <span>Mídia do Produto</span>
                    <span className="text-[9px] opacity-75">Layout: {pdpStyle}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Exemplo de Produto
                  </span>
                  <h4 className="font-bold text-sm leading-tight text-slate-900">Produto Premium Front MK</h4>
                  <p className="text-sm font-black text-indigo-600">R$ 149,90</p>
                </div>

                <div className="space-y-2 pt-2">
                  <button 
                    type="button"
                    className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm hover:bg-indigo-700 transition-colors"
                  >
                    Comprar Agora
                  </button>
                  <button 
                    type="button"
                    className="w-full py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold text-xs border border-indigo-200"
                  >
                    Adicionar ao Carrinho
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className={`mt-auto ${getFooterLayout()} ${currentTheme.colors.surface}`}>
            <div className="px-4 text-[10px]">
              &copy; 2026 <strong>{storeName}</strong>
              <div className="opacity-60 mt-1">Plataforma Front MK</div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
