# DuoVet — Painel da Clínica

App único (`index.html`) para gestão de pacientes, financeiro e agenda da clínica veterinária. Os dados são compartilhados em tempo real entre os veterinários via Firebase, com suporte a múltiplas clínicas (organizações) isoladas entre si.

## Rodando localmente

Abra `index.html` diretamente no navegador. Sem build, sem npm.

## Configuração do Firebase (obrigatória, feita uma vez por quem administra o projeto)

1. Acesse https://console.firebase.google.com/ e crie um projeto novo (plano gratuito "Spark").
2. No menu lateral, vá em **Build → Firestore Database** → "Criar banco de dados" (modo produção, escolha a região mais próxima).
3. Vá em **Build → Authentication → Sign-in method** e ative o provedor **Email/senha**.
4. Vá em **Configurações do projeto → Geral → Seus apps**, crie um "App da Web" (ícone `</>`) e copie o objeto `firebaseConfig` mostrado.
5. Abra `index.html`, procure o comentário `CONFIGURAÇÃO DO FIREBASE — COLE AQUI` (no `<head>`) e substitua os valores de exemplo pelos copiados no passo 4.
6. Em **Firestore Database → Regras**, cole o conteúdo do arquivo `firestore.rules` deste repositório e publique.
7. Em **Firestore Database → Dados**, crie manualmente o documento `organizations/duovet` com o campo `nome: "DuoVet"`.
8. Dentro dele, crie a subcoleção `allowlist` com um documento para cada veterinário autorizado — o **ID do documento** é o email dele em minúsculas (ex: `antonio@suaclinica.com`); o conteúdo pode ficar vazio.
   > **Atenção:** a allowlist só confere o email — não há verificação de posse da caixa de entrada (sem email de confirmação). Enquanto um email liberado ainda não tiver se cadastrado, qualquer pessoa que descubra/adivinhe esse endereço pode criar a conta primeiro pelo cadastro público e ganhar acesso aos dados daquela organização. Recomenda-se pedir para o veterinário se cadastrar assim que for adicionado à allowlist.
9. Pronto — cada veterinário pode abrir o site, clicar em "Criar conta" e usar o código da clínica `duovet` + o email liberado no passo 8.

### Adicionar uma nova clínica no futuro

Repita os passos 7 e 8 com um novo código de organização (ex: `clinica-sul`) e a allowlist daquela clínica. Cada organização fica automaticamente isolada das demais — não é preciso mexer no código do app.

## Mensagens (WhatsApp Cloud API)

A aba "Mensagens" traz as conversas de WhatsApp com os tutores para dentro do painel. Como o token de acesso da Meta é secreto e não pode viver no `index.html` (é um arquivo público), essa funcionalidade depende de um pequeno backend em Firebase Cloud Functions (pasta `functions/`), que hoje não existe em nenhum outro ponto do app.

**Escopo atual: um único número de WhatsApp para uma única organização.** Se um dia for preciso um número por clínica, o `ORG_ID` fixo em `functions/index.js` precisará virar uma lógica de roteamento por número recebido.

### 1. Do lado da Meta (fora deste repositório)

1. Crie um App em https://developers.facebook.com/, adicione o produto **WhatsApp** e conecte-o ao número já usado no app comum do WhatsApp Business.
2. Escolha **Coexistência** no onboarding (mantém o app do celular funcionando junto com a API) — a menos que você queira desativar o app e migrar de vez.
3. Complete a verificação de empresa (Meta Business Manager) — pode levar de dias a semanas.
4. Anote: **WABA ID**, **Phone Number ID**, um **access token permanente** (crie um System User em Business Settings → System Users, com permissão `whatsapp_business_messaging`) e escolha uma string qualquer para ser o `hub.verify_token` do webhook.

### 2. Upgrade do Firebase para o plano Blaze

Cloud Functions com chamadas de saída (para a Graph API da Meta) exigem o plano pay-as-you-go. Em **Configurações do projeto → Uso e faturamento**, faça o upgrade de Spark para Blaze. O uso nesta escala (uma clínica) tende a ficar dentro da faixa gratuita mensal do Blaze, mas fica sujeito a cobrança por conversa da própria Meta.

### 3. Configurar e publicar as Cloud Functions

```bash
npm install -g firebase-tools   # se ainda não tiver
firebase login
cd functions && npm install && cd ..

# Segredos (nunca vão para o repositório):
firebase functions:secrets:set META_ACCESS_TOKEN
firebase functions:secrets:set META_VERIFY_TOKEN

# Variáveis não-secretas: copie functions/.env.example para functions/.env
# e preencha WHATSAPP_ORG_ID (o orgId da clínica, ex: "duovet") e
# WHATSAPP_PHONE_NUMBER_ID (Phone Number ID anotado no passo 1).

firebase deploy --only functions,firestore:rules
```

O deploy imprime a URL da função `whatsappWebhook` (algo como `https://us-central1-<projeto>.cloudfunctions.net/whatsappWebhook`). Cole essa URL + o `META_VERIFY_TOKEN` escolhido no passo 1 na configuração de webhook do App da Meta (Products → WhatsApp → Configuration), e assine os campos `messages`.

### 4. Testar

- Envie uma mensagem de teste do celular da clínica para o número da API e confira se ela aparece em `organizations/{orgId}/conversations` no console do Firestore.
- Abra o painel, vá em "Mensagens" e responda por lá — confirme o recebimento no WhatsApp real.

### Limitações desta fase

- **Janela de 24h**: fora dela, o WhatsApp só permite mensagens de modelo (template) pré-aprovadas pela Meta — enviar templates não está implementado ainda, só o aviso na tela.
- Um único número/organização — ver nota de escopo acima.

## Publicação (GitHub Pages)

Qualquer `git push` para a branch `main` atualiza o site publicado em `https://<usuário-github>.github.io/vet-dashboard/`.
