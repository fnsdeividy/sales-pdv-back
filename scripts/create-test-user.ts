import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'teste@novobanco.com';
  const password = 'teste123';
  const firstName = 'Usuário';
  const lastName = 'Teste';

  console.log('🔧 Criando usuário de teste para o novo banco...');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Senha: ${password}`);

  // Hash da senha
  const hashedPassword = await bcrypt.hash(password, 10);

  // Criar ou atualizar usuário
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      firstName,
      lastName,
      isActive: true,
      emailVerified: true,
    },
    create: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      isActive: true,
      emailVerified: true,
    },
  });

  console.log('✅ Usuário criado/atualizado com sucesso!');
  console.log(`   ID: ${user.id}`);
  console.log(`   Nome: ${user.firstName} ${user.lastName}`);

  // Verificar se existe role 'user', se não existir, criar
  let userRole = await prisma.role.findUnique({
    where: { name: 'user' },
  });

  if (!userRole) {
    console.log('📝 Criando role "user"...');
    userRole = await prisma.role.create({
      data: {
        name: 'user',
        description: 'Regular user role',
        isSystem: true,
      },
    });
  }

  // Associar usuário ao role 'user'
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: userRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: userRole.id,
    },
  });

  console.log('✅ Usuário associado ao role "user"');

  console.log('');
  console.log('🎉 Usuário de teste criado com sucesso!');
  console.log('');
  console.log('📋 Credenciais:');
  console.log(`   Email: ${email}`);
  console.log(`   Senha: ${password}`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar usuário:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
