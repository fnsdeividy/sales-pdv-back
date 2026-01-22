import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateUserRole(email: string, newRoleName: string) {
  console.log(`\n🔧 Atualizando role do usuário: ${email} para "${newRoleName}"`);

  // Buscar usuário
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    console.log(`❌ Usuário não encontrado: ${email}`);
    return;
  }

  console.log(`✅ Usuário encontrado: ${user.firstName} ${user.lastName}`);

  // Buscar ou criar a nova role
  let newRole = await prisma.role.findUnique({
    where: { name: newRoleName },
  });

  if (!newRole) {
    console.log(`📝 Criando role "${newRoleName}"...`);
    newRole = await prisma.role.create({
      data: {
        name: newRoleName,
        description: `${newRoleName} role`,
        isSystem: true,
      },
    });
  }

  // Remover todas as roles antigas do usuário
  if (user.userRoles.length > 0) {
    console.log(`🗑️  Removendo roles antigas...`);
    for (const userRole of user.userRoles) {
      await prisma.userRole.delete({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: userRole.roleId,
          },
        },
      });
      console.log(`   - Removida role: ${userRole.role.name}`);
    }
  }

  // Adicionar a nova role
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: newRole.id,
    },
  });

  console.log(`✅ Role "${newRoleName}" atribuída com sucesso!`);
}

async function main() {
  console.log('🚀 Atualizando roles dos usuários...\n');

  // Usuário 1 - Sistema de Caixa (cashier)
  await updateUserRole('usuario1@teste.com', 'cashier');

  // Usuário 2 - Plataforma Completa (admin)
  await updateUserRole('usuario2@teste.com', 'admin');

  console.log('\n' + '='.repeat(60));
  console.log('🎉 Roles atualizadas com sucesso!');
  console.log('='.repeat(60));
  console.log('\n📋 Configuração Final:\n');

  // Verificar e mostrar os usuários atualizados
  const user1 = await prisma.user.findUnique({
    where: { email: 'usuario1@teste.com' },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  const user2 = await prisma.user.findUnique({
    where: { email: 'usuario2@teste.com' },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (user1) {
    const roles1 = user1.userRoles.map(ur => ur.role.name).join(', ');
    console.log('👤 Usuário 1 - Sistema de Caixa:');
    console.log(`   Email: ${user1.email}`);
    console.log(`   Senha: senha123`);
    console.log(`   Nome: ${user1.firstName} ${user1.lastName}`);
    console.log(`   Role: ${roles1}`);
    console.log(`   Acesso: Sistema de Caixa\n`);
  }

  if (user2) {
    const roles2 = user2.userRoles.map(ur => ur.role.name).join(', ');
    console.log('👤 Usuário 2 - Plataforma Completa:');
    console.log(`   Email: ${user2.email}`);
    console.log(`   Senha: senha456`);
    console.log(`   Nome: ${user2.firstName} ${user2.lastName}`);
    console.log(`   Role: ${roles2}`);
    console.log(`   Acesso: Plataforma Completa\n`);
  }

  console.log('='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Erro ao atualizar roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
