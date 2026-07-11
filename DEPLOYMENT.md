# 📱 Guia de Deployment e Testes

## 🚀 Deploy no Vercel

### Pré-requisitos
- Conta no [Vercel](https://vercel.com)
- GitHub conectado ao Vercel

### Passos

1. **Git Push (se não tiver feito)**
```bash
git add .
git commit -m "Fixes: linter warnings, bundle optimization, Vercel config"
git push origin main
```

2. **Deploy no Vercel**
   - Acesse https://vercel.com/new
   - Conecte seu repositório GitHub
   - Clique em "Import"
   - As configurações serão lidas de `vercel.json` automaticamente
   - Clique "Deploy"

3. **Variáveis de Ambiente (opcional)**
   - No painel do Vercel, vá para Settings → Environment Variables
   - Adicione qualquer secret necessário (não há APIs sensíveis neste app)

4. **Seu app estará disponível em**
   ```
   https://<seu-projeto>.vercel.app
   ```

---

## 📱 Testes no Android

### Opção 1: Web App (Recomendado para começar)
1. Acesse `https://<seu-projeto>.vercel.app` no navegador Android
2. Toque em ⋮ → "Adicionar à tela inicial"
3. Funciona como app nativo (PWA)

### Opção 2: Localhost (Desenvolvimento)
1. No seu PC:
```bash
npm run dev
```

2. Obtenha seu IP local:
```bash
# Windows
ipconfig

# macOS/Linux
ifconfig
```

3. No Android, acesse: `http://<SEU_IP_LOCAL>:5173`

### Opção 3: Android Studio (Full Native)
Para um app nativo real:
```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Initialize
npx cap init read-loud-app

# Build
npm run build
npx cap add android

# Open in Android Studio
npx cap open android
```

---

## 🧪 Testes Recomendados

### No Navegador (Desktop)
- ✅ Upload PDF/EPUB
- ✅ Navegação entre páginas
- ✅ Text-to-Speech (Google Gemini)
- ✅ Modo Biônico
- ✅ Mudança de tema
- ✅ Modo tela cheia

### No Android
- ✅ Upload de livros
- ✅ Scroll/swipe entre páginas
- ✅ Performance em conexões lentas
- ✅ Armazenamento local
- ✅ TTS com fones/alto-falante

### Problemas Conhecidos
- PDF com mais de 500 páginas pode ser lento (otimizável com lazy loading)
- EPUB com imagens grandes pode usar muita RAM
- TTS requer API key do Google Gemini configurada

---

## 📊 Métricas de Build

Após otimização:
| Arquivo | Tamanho | Gzip |
|---------|---------|------|
| gemini | 19.4 KB | 5.73 KB |
| index | 34.35 KB | 10.25 KB |
| vendor | 237.54 KB | 77.10 KB |
| epub | 342.79 KB | 102.72 KB |
| pdf-worker | 410.58 KB | 123.07 KB |
| **TOTAL** | **~1.04 MB** | **~319 KB** |

**Antes:** 2.1 GB (non-minified) → **Depois:** 1.04 MB minified

---

## 🔧 Solução de Problemas

### App não carrega no Vercel
```bash
npm run build
# Verifique se não há erros
```

### TTS não funciona
- Adicione sua API key do Google Gemini nas configurações do app
- Verifique quota da API

### Livros não salvam
- Verifique se localStorage está ativo no navegador
- Limpe cache e tente novamente

---

## 📝 Checklist Pré-Deploy

- [ ] `npm run lint` passou (0 erros)
- [ ] `npm run build` criou dist/ com sucesso
- [ ] Testou no navegador local
- [ ] Configurou `vercel.json`
- [ ] `.nvmrc` define Node 18.17.0
- [ ] Git commit com todas as mudanças

---

**Pronto para deploy! 🎉**
