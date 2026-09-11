const fs = require('fs');
let code = fs.readFileSync('src/layouts/StorefrontLayout.tsx', 'utf8');

const userControls = `
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: themeColor }}>
                  {customer.name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="text-xs text-slate-800 font-bold block max-w-[120px] truncate leading-tight">
                    {customer.name}
                  </span>
                </div>
                <Link
                  to={\`/\${store.slug}/orders\`}
                  title="Meus Pedidos"
                  className="p-1 text-slate-500 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer ml-1"
                >
                  <Package className="w-4 h-4" />
                </Link>
                <button 
                  onClick={() => logoutCustomer(store.id)} 
                  title="Sair da Conta"
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-white transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
`;

code = code.replace(
  /<div className="flex items-center gap-2 bg-slate-50 border border-slate-200\/80 px-2\.5 py-1\.5 rounded-xl">[\s\S]*?<\/div>\s*\)\s*:\s*\(/,
  userControls + "            ) : ("
);

if (!code.includes('Package')) {
  code = code.replace("LogOut,", "LogOut,\n  Package,");
}

fs.writeFileSync('src/layouts/StorefrontLayout.tsx', code);
