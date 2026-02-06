🛒 D’Lara Enxovais – Sistema de Ponto de Venda (PDV)

Sistema completo de Ponto de Venda (PDV) desenvolvido para a loja D’Lara Enxovais, com foco em agilidade, controle financeiro e boa experiência do operador.

O projeto contempla controle de vendas, pagamentos múltiplos, gestão de caixa, clientes, produtos e estoque, utilizando boas práticas de arquitetura, tipagem forte e separação clara de responsabilidades.

🚀 Tecnologias Utilizadas
Frontend

Angular 20 (Standalone Components)

TypeScript

Angular Signals

Angular Material

RxJS

SCSS

Backend

Java 21

Spring Boot 3.5.x

Spring Security 6 (JWT)

Hibernate / JPA

PostgreSQL

Swagger / OpenAPI

🧱 Arquitetura do Projeto

O projeto segue princípios modernos de arquitetura:

Separação entre UI Models e DTOs de API

Services responsáveis apenas por comunicação com backend

Componentes standalone

Signals para estado local

RxJS para fluxos assíncronos

Boas práticas (SOLID, Clean Code)

📁 Estrutura Simplificada
src/
 ├── app/
 │   ├── core/
 │   │   ├── service/        # Serviços de API (DTOs do backend)
 │   │   └── auth/           # Autenticação e sessão
 │   ├── pages/
 │   │   └── pdv/            # Tela principal de vendas
 │   ├── shared/
 │   │   ├── models/
 │   │   │   ├── payment/    # Models de UI (PaymentData, Split, etc)
 │   │   │   ├── customer/
 │   │   │   └── cash/
 │   │   └── components/     # Modais e componentes reutilizáveis
 │   └── environments/
 └── assets/

💰 Funcionalidades Principais
🧾 Vendas

Criação e edição de vendas

Carrinho com controle de quantidade

Descontos manuais

Recuperação de vendas pendentes

👤 Clientes

Busca por nome, telefone ou ID

Cadastro rápido via modal

Seleção automática após cadastro

📦 Produtos

Busca por nome, código ou código de barras

Destaque de estoque baixo

Grid responsivo (3 cards por linha)

Produtos mais vendidos

🏦 Caixa

Abertura obrigatória antes de vender

Validação de caixa aberto no backend

Integração com fluxo de vendas

💳 Pagamentos (Destaque do Sistema)

Pagamento múltiplo por venda

Dinheiro, PIX, Crédito e Débito

Cálculo automático de troco

Validação de valor total pago

Modal inteligente e editável

🔁 Fluxo de Venda
1. Abrir Caixa
2. Selecionar Cliente
3. Adicionar Produtos
4. Aplicar Desconto (opcional)
5. Finalizar Venda (status PENDING)
6. Realizar Pagamento
7. Venda marcada como PAID
8. Carrinho limpo automaticamente

💳 Pagamento Múltiplo – Exemplo

Exemplo de pagamento dividido:

Total da venda: R$ 240,00

- PIX:        R$ 100,00
- Dinheiro:   R$ 200,00
- Troco:      R$ 60,00


O sistema:

Identifica automaticamente o troco

Envia apenas valores válidos ao backend

Mantém histórico consistente

🔌 Integração com Backend
Endpoint de Pagamento
POST /api/payments
Content-Type: application/json

{
  "saleId": 1,
  "paymentMethod": "DINHEIRO",
  "amountPaid": 300
}

Resposta
{
  "id": 10,
  "saleId": 1,
  "paymentMethod": "DINHEIRO",
  "amountPaid": 300,
  "changeAmount": 60,
  "paymentDate": "2025-12-03T21:59:49.4864605"
}

📐 Boas Práticas Adotadas

❌ Nenhum DTO de backend usado diretamente na UI

✅ Models de UI isolados em shared/models

✅ Services responsáveis apenas por HTTP

✅ Tipagem forte em todo o projeto

✅ Estados controlados por Signals

✅ Tratamento de erros centralizado

✅ Código organizado e escalável

▶️ Como Executar o Projeto
Frontend
npm install
ng serve


Acesse:

http://localhost:4200

Backend
mvn clean install
mvn spring-boot:run


Acesse:

http://localhost:8080


Swagger:

http://localhost:8080/swagger-ui.html

🧠 Próximos Passos (Roadmap)

📊 Dashboard financeiro

🧾 Relatórios de vendas

📦 Controle avançado de estoque

🧑‍💼 Permissões por perfil de usuário

🖨️ Impressão de comprovantes

📱 Versão mobile-friendly

👨‍💻 Autor

Leandro Rodrigues
Sistema desenvolvido para D’Lara Enxovais