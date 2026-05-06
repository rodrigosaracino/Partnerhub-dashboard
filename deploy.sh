#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# PartnerHub — Script de Setup Inicial na VPS
# Execute UMA VEZ na VPS após o primeiro git clone:
#   bash deploy.sh
# ─────────────────────────────────────────────────────────────
set -e

PROJECT_DIR="/var/www/partnerhub"
REPO_URL="https://github.com/rodrigosaracino/Partnerhub-dashboard.git"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PartnerHub — Setup Inicial na VPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Instalar Node.js se necessário
if ! command -v node &>/dev/null; then
  echo "→ Instalando Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 2. Instalar PM2 se necessário
if ! command -v pm2 &>/dev/null; then
  echo "→ Instalando PM2..."
  sudo npm install -g pm2
fi

# 3. Clonar repositório
if [ ! -d "$PROJECT_DIR" ]; then
  echo "→ Clonando repositório..."
  sudo mkdir -p "$PROJECT_DIR"
  sudo chown $USER:$USER "$PROJECT_DIR"
  git clone "$REPO_URL" "$PROJECT_DIR"
else
  echo "→ Repositório já existe em $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# 4. Criar arquivo .env se não existir
if [ ! -f "server/.env" ]; then
  echo "→ Criando server/.env a partir do exemplo..."
  cp server/.env.example server/.env
  echo ""
  echo "⚠️  ATENÇÃO: Edite o arquivo server/.env com suas credenciais reais:"
  echo "   nano $PROJECT_DIR/server/.env"
  echo ""
fi

# 5. Instalar dependências da API
echo "→ Instalando dependências da API..."
cd "$PROJECT_DIR/server"
npm install

# 6. Build do frontend
echo "→ Instalando dependências do frontend..."
cd "$PROJECT_DIR"
npm install

echo "→ Fazendo build do frontend..."
npm run build

# 7. Iniciar API com PM2
echo "→ Iniciando API com PM2..."
cd "$PROJECT_DIR/server"
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

# 8. Criar diretório de logs do PM2
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Setup concluído!"
echo ""
echo "  Próximos passos:"
echo "  1. Edite as credenciais: nano $PROJECT_DIR/server/.env"
echo "  2. Reinicie a API:       pm2 restart partnerhub-api"
echo "  3. Configure o Nginx:    veja server/nginx.conf"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
