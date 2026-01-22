import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createUser(email: string, password: string, firstName: string, lastName: string, roleName: string = 'user') {
  console.log(`\n🔧 Criando usuário: ${email}`);
  
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

  console.log(`✅ Usuário criado/atualizado: ${user.firstName} ${user.lastName} (ID: ${user.id})`);

  // Verificar se existe role, se não existir, criar
  let role = await prisma.role.findUnique({
    where: { name: roleName },
  });

  if (!role) {
    console.log(`📝 Criando role "${roleName}"...`);
    role = await prisma.role.create({
      data: {
        name: roleName,
        description: `${roleName} role`,
        isSystem: true,
      },
    });
  }

  // Associar usuário ao role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  console.log(`✅ Usuário associado ao role "${roleName}"`);

  return { email, password, firstName, lastName, role: roleName };
}

async function main() {
  console.log('🚀 Criando 2 usuários de teste para o novo banco...\n');

  // Criar primeiro usuário
  const user1 = await createUser(
    'usuario1@teste.com',
    'senha123',
    'Usuário',
    'Um',
    'user'
  );

  // Criar segundo usuário
  const user2 = await createUser(
    'usuario2@teste.com',
    'senha456',
    'Usuário',
    'Dois',
    'user'
  );

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Usuários criados com sucesso!');
  console.log('='.repeat(60));
  console.log('\n📋 Credenciais dos Usuários:\n');
  
  console.log('👤 Usuário 1:');
  console.log(`   Email: ${user1.email}`);
  console.log(`   Senha: ${user1.password}`);
  console.log(`   Nome: ${user1.firstName} ${user1.lastName}`);
  console.log(`   Role: ${user1.role}\n`);

  console.log('👤 Usuário 2:');
  console.log(`   Email: ${user2.email}`);
  console.log(`   Senha: ${user2.password}`);
  console.log(`   Nome: ${user2.firstName} ${user2.lastName}`);
  console.log(`   Role: ${user2.role}\n`);
  
  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar usuários:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
