# Remoção do Trial e Implementação do Fluxo de Pagamento Direto

## Resumo da Alteração

Remoção completa do fluxo de trial (período de teste gratuito de 7 dias) e implementação de um novo fluxo onde o usuário, ao se cadastrar, escolhe o plano desejado e é redirecionado diretamente para o pagamento.

---

## O que mudou

### Fluxo Anterior (Trial)
1. Usuário se cadastrava em `/register`
2. Conta era criada sem plano vinculado
3. Ao acessar pela primeira vez, uma assinatura TRIAL era criada automaticamente (7 dias)
4. Modal de "Período de teste" era exibido após login
5. Após 7 dias, sistema bloqueava acesso e pedia para assinar
6. Usuário escolhia plano e era redirecionado ao Asaas para pagamento

### Fluxo Novo (Pagamento Direto)
1. Usuário clica em "Assinar agora" na página de planos (landing page)
2. É redirecionado para `/register?plan=pro` (com plano pré-selecionado)
3. Formulário de cadastro possui campo obrigatório de seleção de plano
4. Ao finalizar cadastro, conta é criada com status `PENDING_PAYMENT` vinculada ao plano
5. Usuário é redirecionado automaticamente para o link de pagamento do Asaas
6. Após confirmação do pagamento (webhook), status muda para `ACTIVE`

---

## Alterações Detalhadas

### Backend (sales-pdv-back)

#### 1. Auth Service (`src/modules/auth/application/auth.service.ts`)
- **Adicionado**: Parâmetro `plan` no método `register()`
- **Adicionado**: Validação do plano (`start`, `pro`, `premium`)
- **Adicionado**: Criação automática de `StoreSubscription` com status `PENDING_PAYMENT` no momento do registro
- **Adicionado**: Retorno das informações do plano na resposta do registro (`plan.id`, `plan.name`, `plan.status`)
- **Adicionado**: Métodos auxiliares `VALID_PLANS` e `getPlanName()`

#### 2. Auth Controller (`src/modules/auth/presentation/auth.controller.ts`)
- **Adicionado**: Campo `plan: string` no DTO de registro
- **Atualizado**: Log inclui o plano selecionado
- **Atualizado**: Passa `plan` para o `authService.register()`

#### 3. Subscription Service (`src/modules/subscription/application/subscription.service.ts`)
- **Removido**: Constante `DEFAULT_TRIAL_DAYS = 7`
- **Removido**: Método `getOrCreateStoreSubscription()` (criava trial automaticamente)
- **Removido**: Status `TRIAL` do tipo `SubscriptionStatus`
- **Removido**: Lógica de cálculo de trial no `calculateEffectiveStatus()`
- **Removido**: Campo `trialEndsAt` da interface `Subscription`
- **Adicionado**: Status `PENDING_PAYMENT` ao tipo `SubscriptionStatus`
- **Adicionado**: Tratamento de `PENDING_PAYMENT` no `calculateEffectiveStatus()`
- **Atualizado**: `getSubscription()` retorna `PENDING_PAYMENT` quando não há assinatura

#### 4. Stores Service (`src/modules/store/application/stores.service.ts`)
- **Removido**: Método `isSubscriptionInTrial()`
- **Adicionado**: Método `isSubscriptionPendingPayment()`
- **Atualizado**: Lógica fiscal agora bloqueia por `pending_payment` ao invés de `trial`

#### 5. Subscription Admin Controller (`src/modules/subscription/presentation/subscription-admin.controller.ts`)
- **Atualizado**: Tipo `AdminSubscriptionStatus` inclui `PENDING_PAYMENT` ao invés de `TRIAL`
- **Mantido**: Endpoint de trial admin (backward compatibility, pode ser removido futuramente)

#### 6. Webhook Asaas (`src/modules/subscription/application/asaas-webhook.service.ts`)
- **Sem alterações**: O webhook já tratava a transição para `ACTIVE` corretamente, limpando dados de trial

---

### Frontend (sales-pdv-front)

#### 1. Página de Registro (`src/pages/Register.tsx`)
- **Adicionado**: Campo `Select` obrigatório para seleção de plano (Start, Pro, Premium)
- **Adicionado**: Leitura de query param `plan` para pré-seleção automática
- **Adicionado**: Leitura de `localStorage('selected_plan')` como fallback
- **Adicionado**: Validação Zod para o campo `plan`
- **Atualizado**: Botão de submit: "Criar conta e ir para pagamento"
- **Atualizado**: Após registro, redireciona para link de pagamento do Asaas (ao invés de `/dashboard`)
- **Atualizado**: Mensagem de toast: "Redirecionando para o pagamento..."

#### 2. Auth Context (`src/contexts/auth-context.tsx`)
- **Atualizado**: Método `signUp()` recebe parâmetro `plan`
- **Atualizado**: Interface `AuthContextType` atualizada
- **Atualizado**: Payload da API inclui campo `plan`

#### 3. Hook use-subscription (`src/hooks/use-subscription.ts`)
- **Removido**: Import de `TRIAL_PERIOD_DAYS` e `use-trial-period`
- **Removido**: Fallback baseado em `createdAt` do usuário
- **Removido**: Lógica de cálculo de trial no fallback
- **Removido**: Logs de debug (agent logs)
- **Atualizado**: Fallback agora retorna `PENDING_PAYMENT` ao invés de `TRIAL`
- **Atualizado**: `isPaidPlan` verifica apenas `ACTIVE` com `apiSubscription`

#### 4. Subscription Service (`src/services/subscription.service.ts`)
- **Atualizado**: Tipo `SubscriptionStatus` substituiu `TRIAL` por `PENDING_PAYMENT`

#### 5. AppLayout (`src/components/layout/AppLayout.tsx`)
- **Removido**: Import de `TrialNotificationModal`
- **Removido**: Import de `useTrialPeriod`
- **Removido**: Estado `showTrialModal` e lógica do useEffect que o controlava
- **Removido**: JSX do `TrialNotificationModal`
- **Removido**: Referência a `sessionStorage('trialModalShown')`
- **Removido**: Badge de dias de trial no header
- **Atualizado**: CTA do header agora mostra "Finalizar pagamento" para `PENDING_PAYMENT`
- **Atualizado**: `shouldBlockContent` bloqueia para `PENDING_PAYMENT` e `EXPIRED`

#### 6. TrialGuard (`src/components/layout/TrialGuard.tsx`)
- **Removido**: Import de `useTrialPeriod`
- **Removido**: Referências a `isTrialActive`, `daysRemaining`
- **Atualizado**: Verifica `PENDING_PAYMENT` ao invés de `TRIAL`
- **Atualizado**: Comentários atualizados para refletir novo fluxo

#### 7. SubscriptionBanner (`src/components/subscription/SubscriptionBanner.tsx`)
- **Removido**: Banner de trial ("Período de teste")
- **Adicionado**: Banner de "Pagamento pendente" para status `PENDING_PAYMENT`

#### 8. SubscriptionBlocker (`src/components/subscription/SubscriptionBlocker.tsx`)
- **Atualizado**: Bloqueia acesso para `PENDING_PAYMENT` além de `EXPIRED`
- **Atualizado**: Mensagens diferenciadas para cada status

#### 9. Página de Planos (`src/pages/Planos.tsx`)
- **Removido**: Hero de "Período de teste" (TRIAL)
- **Adicionado**: Hero de "Pagamento pendente" (PENDING_PAYMENT)
- **Removido**: Texto "Todos os planos incluem 7 dias grátis"
- **Removido**: FAQ sobre "período de teste"
- **Adicionado**: FAQ sobre "Como funciona o pagamento?"
- **Atualizado**: Lógica de plano recomendado usa `PENDING_PAYMENT` ao invés de `TRIAL`

#### 10. Pricing Landing (`src/components/landing/Pricing.tsx`)
- **Atualizado**: Botão "Começar teste grátis" alterado para "Assinar agora"
- **Atualizado**: Texto "7 dias grátis" removido
- **Atualizado**: Navega para `/register?plan={planId}` ao invés de salvar no localStorage

#### 11. TrialSection Landing (`src/components/landing/TrialSection.tsx`)
- **Atualizado**: Título "Teste grátis por 3 dias" alterado para "Comece agora mesmo"
- **Atualizado**: Texto e botão atualizados para refletir fluxo de assinatura direta

#### 12. Páginas com Trial Block removido
- **Dashboard.tsx**: Removido `TrialExpiredBlock`, `TrialDashboardCard`, `useTrialPeriod`
- **DashboardTest.tsx**: Removido `useTrialPeriod`
- **Login.tsx**: Removido `useTrialPeriod`
- **Vendas.tsx**: Removido `TrialBlockModal`, `useTrialBlock`
- **NotasFiscais.tsx**: Removido `TrialBlockModal`, `useTrialBlock`
- **CaixaRegistradora.tsx**: Removido `TrialExpiredBlock`, `TrialBlockModal`, `useTrialBlock`; status `TRIAL` removido do `hasAccess`
- **Financeiro.tsx**: Removido `TrialExpiredBlock`
- **Configuracoes.tsx**: Trial substituído por `PENDING_PAYMENT`
- **Assinatura.tsx**: Trial substituído por subscription-based logic

---

## Status da Assinatura (Novo Fluxo)

| Status | Descrição |
|--------|-----------|
| `PENDING_PAYMENT` | Conta criada, aguardando primeiro pagamento |
| `ACTIVE` | Assinatura ativa (pagamento confirmado) |
| `EXPIRED` | Assinatura expirada (período vencido) |
| `CANCELED` | Assinatura cancelada pelo usuário |

---

## Payload do Registro (Novo)

```json
{
  "ownerName": "João Silva",
  "storeName": "Loja do João",
  "email": "joao@email.com",
  "whatsapp": "21999999999",
  "password": "123456",
  "plan": "pro",
  "cnpj": "12345678901",
  "address": "Rua Exemplo, 123",
  "city": "Rio de Janeiro",
  "state": "RJ",
  "zipCode": "20000000"
}
```

## Resposta do Registro (Novo)

```json
{
  "user": {
    "id": "uuid",
    "email": "joao@email.com",
    "name": "João Silva",
    "role": "admin",
    "roles": ["admin"],
    "createdAt": "2026-02-13T...",
    "storeId": "uuid"
  },
  "plan": {
    "id": "pro",
    "name": "Plano Pro",
    "status": "PENDING_PAYMENT"
  },
  "token": "jwt..."
}
```

---

## URLs de Redirecionamento por Plano

| Plano | URL |
|-------|-----|
| Start | `https://www.asaas.com/c/c5ynq9izdl08lgtj` |
| Pro | Variável de ambiente `VITE_PLAN_PRO_ROUTE` |
| Premium | Variável de ambiente `VITE_PLAN_PREMIUM_ROUTE` |

---

## Query Params Suportados

| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `plan` | Pré-seleciona o plano no cadastro | `/register?plan=pro` |

---

## Critérios de Aceitação Verificados

- [x] O formulário de cadastro possui campo obrigatório de seleção de plano
- [x] O plano é automaticamente pré-selecionado quando o usuário vem da página de planos
- [x] O backend valida o plano recebido (start, pro, premium)
- [x] O usuário é criado com o plano correto no banco (StoreSubscription)
- [x] Após cadastro, o checkout é iniciado com redirecionamento ao Asaas
- [x] Não há mais fluxo automático de trial
- [x] Status PENDING_PAYMENT bloqueia acesso até pagamento ser confirmado
- [x] Webhook Asaas transiciona de PENDING_PAYMENT para ACTIVE

---

## Arquivos que podem ser removidos futuramente

Os seguintes arquivos de trial não são mais importados por nenhum componente ativo, mas foram mantidos para evitar quebras em imports residuais. Eles podem ser removidos com segurança:

- `src/hooks/use-trial-period.ts`
- `src/hooks/use-trial-block.ts`
- `src/hooks/use-trial-block.test.tsx`
- `src/hooks/use-trial-toast.ts`
- `src/components/ui/trial-banner.tsx`
- `src/components/ui/trial-block-modal.tsx`
- `src/components/ui/trial-notification-modal.tsx`
- `src/components/ui/trial-expired-block.tsx`
- `src/components/ui/trial-dashboard-card.tsx`

---

## Data da Alteração

13 de Fevereiro de 2026
