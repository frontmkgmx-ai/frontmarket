const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/EmailsConfig.tsx', 'utf8');

const interfaceBlock = `interface StatusEmails {`;
const newInterface = `interface TemplateConfig {
  logoUrl: string;
  primaryColor: string;
  backgroundColor: string;
  footerText: string;
}

interface StatusEmails {`;

code = code.replace(interfaceBlock, newInterface);

const defaultStatusBlock = `const DEFAULT_STATUS_EMAILS: StatusEmails = {`;
const newDefault = `const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  logoUrl: '',
  primaryColor: '#4f46e5',
  backgroundColor: '#f8fafc',
  footerText: '© {{store_name}}. Todos os direitos reservados.'
};

const DEFAULT_STATUS_EMAILS: StatusEmails = {`;

code = code.replace(defaultStatusBlock, newDefault);

const activeTabRegex = /const \[activeTab, setActiveTab\] = useState<'status' \| 'products'>\('status'\);/;
code = code.replace(activeTabRegex, "const [activeTab, setActiveTab] = useState<'status' | 'products' | 'template'>('status');\n  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>(DEFAULT_TEMPLATE_CONFIG);");

const loadDataBlock = `          if (data.statusEmails) setStatusEmails(data.statusEmails);
          if (data.productEmails) setProductEmails(data.productEmails);`;
const newLoadData = `          if (data.statusEmails) setStatusEmails(data.statusEmails);
          if (data.productEmails) setProductEmails(data.productEmails);
          if (data.templateConfig) setTemplateConfig(data.templateConfig);`;

code = code.replace(loadDataBlock, newLoadData);

const saveAllBlock = `        statusEmails,
        productEmails,
        updatedAt: new Date()`;
const newSaveAll = `        statusEmails,
        productEmails,
        templateConfig,
        updatedAt: new Date()`;

code = code.replace(saveAllBlock, newSaveAll);

// Add the Visual tab button
const tabButtonsRegex = /<button\s+onClick=\{\(\) => setActiveTab\('products'\)\}\s+className=\{`px-4 py-3 text-sm font-semibold border-b-2 transition-colors \$\{activeTab === 'products' \? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`\}>\s*E-mails de Produtos\s*<\/button>\s*<\/div>/;
const newTabButtons = `<button
              onClick={() => setActiveTab('products')}
              className={\`px-4 py-3 text-sm font-semibold border-b-2 transition-colors \${activeTab === 'products' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
            >
              E-mails de Produtos
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={\`px-4 py-3 text-sm font-semibold border-b-2 transition-colors \${activeTab === 'template' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}\`}
            >
              Visual do E-mail
            </button>
          </div>`;

code = code.replace(tabButtonsRegex, newTabButtons);

// Inject the template tab content just before the end of the content wrapper (before <div className="px-6 py-4 bg-white border-t border-slate-200)
const templateTabContent = `
          {activeTab === 'template' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">Aparência do E-mail</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL do Logotipo</label>
                    <input
                      type="text"
                      value={templateConfig.logoUrl}
                      onChange={(e) => setTemplateConfig({ ...templateConfig, logoUrl: e.target.value })}
                      placeholder="https://sua-loja.com/logo.png"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Recomendado: Imagem PNG com fundo transparente.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor Principal (Botões e Destaques)</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={templateConfig.primaryColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, primaryColor: e.target.value })}
                          className="w-10 h-10 p-0 border-0 rounded overflow-hidden cursor-pointer"
                        />
                        <input
                          type="text"
                          value={templateConfig.primaryColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, primaryColor: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cor de Fundo do E-mail</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={templateConfig.backgroundColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, backgroundColor: e.target.value })}
                          className="w-10 h-10 p-0 border-0 rounded overflow-hidden cursor-pointer"
                        />
                        <input
                          type="text"
                          value={templateConfig.backgroundColor}
                          onChange={(e) => setTemplateConfig({ ...templateConfig, backgroundColor: e.target.value })}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Texto do Rodapé</label>
                    <textarea
                      rows={2}
                      value={templateConfig.footerText}
                      onChange={(e) => setTemplateConfig({ ...templateConfig, footerText: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Variáveis disponíveis: {"{{store_name}}"}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-800 mb-4">Pré-visualização</h3>
                <div 
                  className="rounded-lg p-6 flex flex-col items-center justify-center min-h-[300px] border border-slate-100"
                  style={{ backgroundColor: templateConfig.backgroundColor }}
                >
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 w-full max-w-md overflow-hidden">
                    {templateConfig.logoUrl && (
                      <div className="p-6 pb-2 text-center border-b border-slate-50">
                        <img src={templateConfig.logoUrl} alt="Logo" className="max-h-12 mx-auto" />
                      </div>
                    )}
                    <div className="p-6 space-y-4">
                      <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-4 w-full bg-slate-200 rounded animate-pulse"></div>
                      <div className="h-4 w-5/6 bg-slate-200 rounded animate-pulse"></div>
                      <div className="pt-2">
                        <div 
                          className="h-10 w-full rounded-md opacity-80"
                          style={{ backgroundColor: templateConfig.primaryColor }}
                        ></div>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 text-center text-xs text-slate-500 border-t border-slate-100">
                      {templateConfig.footerText.replace(/\\{\\{store_name\\}\\}/g, activeStore?.name || 'Sua Loja')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* Global Save Action */}`;

const targetBlockRegex = /<\/div>\s*\{\/\* Global Save Action \*\/\}/;
code = code.replace(targetBlockRegex, templateTabContent);

fs.writeFileSync('src/pages/admin/EmailsConfig.tsx', code);
