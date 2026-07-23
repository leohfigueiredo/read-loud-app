#!/bin/bash

# Define a cor azul e reset
BLUE='\033[0;34m'
NC='\033[0m' # No Color
YELLOW='\033[1;33m'
RED='\033[0;31m'

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}  Iniciando LocalTunnel: https://leoreader.loca.lt${NC}"
echo -e "${BLUE}===================================================${NC}"
echo "Mantenha esta janela aberta. Se a conexão cair,"
echo "ela será reiniciada automaticamente."
echo ""

while true; do
    echo -e "${YELLOW}[*] Conectando ao LocalTunnel...${NC}"
    npx localtunnel --port 8888 --subdomain leoreader
    
    echo ""
    echo -e "${RED}[!] Conexão com o LocalTunnel foi perdida!${NC}"
    echo -e "${YELLOW}[!] Aguardando 10 segundos para o servidor liberar o nome 'leoreader'...${NC}"
    sleep 10
done
