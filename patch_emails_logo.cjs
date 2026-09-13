const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/EmailsConfig.tsx', 'utf8');

if (!code.includes("import { uploadFileToStreamx }")) {
  code = code.replace(
    "import { Product } from '../../types';",
    "import { Product } from '../../types';\nimport { uploadFileToStreamx } from '../../lib/streamx';"
  );
}

// Add state for uploadingLogo
if (!code.includes("const [uploadingLogo, setUploadingLogo] = useState(false);")) {
  const findState = "const [isAddingProduct, setIsAddingProduct] = useState(false);";
  const replaceState = `const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    setUploadingLogo(true);
    try {
      const url = await uploadFileToStreamx(e.target.files[0]);
      setTemplateConfig(prev => ({ ...prev, logoUrl: url }));
    } catch (err) {
      console.error(err);
      alert('Erro ao fazer upload da logo');
    } finally {
      setUploadingLogo(false);
    }
  };`;
  code = code.replace(findState, replaceState);
}

// Replace the URL input with the file upload button
const oldLogoField = `                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">URL do Logotipo</label>
                    <input
                      type="text"
                      value={templateConfig.logoUrl}
                      onChange={(e) => setTemplateConfig({ ...templateConfig, logoUrl: e.target.value })}
                      placeholder="https://sua-loja.com/logo.png"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Recomendado: Imagem PNG com fundo transparente.</p>
                  </div>`;

const newLogoField = `                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Logotipo do E-mail</label>
                    <div className="flex gap-2">
                      <label className="flex items-center justify-center px-4 py-2 bg-slate-900 text-white rounded-lg cursor-pointer hover:bg-slate-800 transition-colors text-sm font-medium">
                        {uploadingLogo ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          'Fazer Upload'
                        )}
                        <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                      </label>
                      {templateConfig.logoUrl && (
                        <button
                          onClick={() => setTemplateConfig({ ...templateConfig, logoUrl: '' })}
                          className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">Recomendado: Imagem PNG com fundo transparente.</p>
                  </div>`;

code = code.replace(oldLogoField, newLogoField);

fs.writeFileSync('src/pages/admin/EmailsConfig.tsx', code);
