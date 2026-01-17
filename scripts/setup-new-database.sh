#!/bin/bash

# Script para configurar o novo banco de dados isolado
echo "🔧 Configurando novo banco de dados isolado..."

# Verificar se o docker-compose está rodando
if ! docker ps | grep -q sales_pdv_postgres; then
    echo "❌ Container do banco não está rodando. Execute primeiro:"
    echo "   docker-compose -f docker-compose.new-db.yml up -d"
    exit 1
fi

# Aguardar o banco estar disponível
echo "⏳ Aguardando PostgreSQL estar disponível..."
sleep 5

# Verificar conexão
until docker exec sales_pdv_postgres pg_isready -U sales_pdv_user -d sales_pdv_db > /dev/null 2>&1; do
    echo "⏳ Aguardando PostgreSQL..."
    sleep 2
done

echo "✅ PostgreSQL está disponível!"

# Executar migrations do Prisma
echo "📝 Executando migrations do Prisma..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo "✅ Migrations executadas com sucesso!"
else
    echo "❌ Erro ao executar migrations"
    exit 1
fi

# Executar seeds
echo "🌱 Executando seeds..."
npx prisma db seed

if [ $? -eq 0 ]; then
    echo "✅ Seeds executados com sucesso!"
else
    echo "⚠️  Seeds não executados (pode ser normal se não houver seeds configurados)"
fi

echo ""
echo "🎉 Novo banco de dados configurado com sucesso!"
echo ""
echo "📊 Informações do banco:"
echo "  - Nome: sales_pdv_db"
echo "  - Usuário: sales_pdv_user"
echo "  - Porta: 5434"
echo "  - Container: sales_pdv_postgres"
echo ""
echo "💡 Para usar este banco, copie o arquivo .env.new-db para .env:"
echo "   cp .env.new-db .env"
