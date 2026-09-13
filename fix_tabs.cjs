const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/EmailsConfig.tsx', 'utf8');

const target = `          <button
            onClick={() => setActiveTab('products')}
            className={\`pb-4 text-sm font-bold border-b-2 transition-colors \${activeTab === 'products' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
          >
            E-mails Específicos por Produto
          </button>
        </div>`;

const newTabs = `          <button
            onClick={() => setActiveTab('products')}
            className={\`pb-4 text-sm font-bold border-b-2 transition-colors \${activeTab === 'products' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
          >
            E-mails Específicos por Produto
          </button>
          <button
            onClick={() => setActiveTab('template')}
            className={\`pb-4 text-sm font-bold border-b-2 transition-colors \${activeTab === 'template' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
          >
            Visual do E-mail
          </button>
        </div>`;

code = code.replace(target, newTabs);
fs.writeFileSync('src/pages/admin/EmailsConfig.tsx', code);
console.log(code.includes('Visual do E-mail') ? 'Tab button injected' : 'Failed to inject');
