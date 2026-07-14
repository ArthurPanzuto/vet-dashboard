# Backend Firebase + Publicação no GitHub Pages — Design

## Contexto

O DuoVet hoje é um app estático single-file (`index.html`) sem backend: todos os dados (pacientes, financeiro, agenda, categorias) vivem no `localStorage` do navegador. Isso funciona para uso solo em uma máquina, mas não serve para o uso real da clínica: cada veterinário abrindo o app em seu próprio computador/celular teria uma cópia de dados totalmente isolada — ninguém veria os pacientes ou lançamentos um do outro, o que quebra o próprio recurso de "pacientes por veterinário" que construímos.

Este projeto adiciona um backend compartilhado (Firebase/Firestore) e publica o app no GitHub Pages, para que todos os veterinários acessem os mesmos dados de qualquer aparelho.

## Escopo

**Dentro do escopo:**
- Migrar toda a persistência (pacientes, transações, despesas, agendamentos, categorias, tipos de evento) de `localStorage` para Firestore, mantendo a API pública do módulo `state` inalterada onde possível.
- Substituir o login por senha compartilhada (atual) por contas reais no Firebase Authentication (email/senha), com autocadastro protegido por lista de emails permitidos (allowlist) **por organização (clínica)**.
- Modelo de dados **multi-organização desde já**: cada clínica tem seus próprios dados, totalmente isolados de outras clínicas, mesmo que hoje só exista uma (a DuoVet). Isso prepara o terreno para vender o sistema a outras clínicas no futuro, sem precisar remodelar o banco depois.
- Sincronização em tempo real entre abas/aparelhos via `onSnapshot`.
- Publicação do repositório no GitHub e habilitação do GitHub Pages.
- Estados de carregamento e erro de rede (antes inexistentes, pois localStorage é síncrono).
- **Login passa a ser exigido para o app inteiro**, não só para a aba Pacientes — consequência direta de os dados (inclusive financeiro/agenda) agora serem reais e compartilhados via Firestore, protegidos por regras de segurança que exigem autenticação.

**Fora do escopo (não será feito neste projeto):**
- Migração dos dados de teste já existentes no `localStorage` atual — o banco no Firebase começa vazio.
- Cloud Functions / billing pago do Firebase — tudo é feito com o plano gratuito "Spark" (Firestore + Auth), sem servidor próprio.
- Recuperação de senha, verificação de email, ou qualquer fluxo avançado de conta — só criação de conta (gated por allowlist) e login.
- Modo offline "de verdade" (fila de sincronização quando sem internet) — apenas uma mensagem de erro simples quando não há conexão.
- **Tela de autocadastro de organização** ("criar minha clínica"): por enquanto, novas organizações são criadas manualmente pelo administrador (você) direto no Console do Firebase. O modelo de dados já suporta múltiplas organizações, mas a tela de "criar uma clínica nova" fica para um projeto futuro, se/quando surgir uma segunda clínica de verdade.
- Um usuário pertencer a mais de uma organização, ou trocar de organização depois de cadastrado.

## Arquitetura

O app continua sendo um único arquivo `index.html` estático, sem etapa de build. O SDK do Firebase (v10+, modular) é carregado via `<script type="module">` com imports diretos de URL do CDN (`https://www.gstatic.com/firebasejs/...`) — sem npm, sem bundler, consistente com o padrão já usado para Chart.js/jsPDF.

O módulo `state` deixa de ler/escrever em `localStorage` e passa a ser alimentado por listeners do Firestore (`onSnapshot`), mantendo a mesma API pública já usada pelos demais módulos (`getPatients()`, `addPatient()`, `updatePatient()`, `getTransactions()`, etc.) — os módulos consumidores (`pacientes.js`, `despesas.js`, `calendar.js`, `dashboard.js`, `relatorio.js`) não precisam mudar a forma como chamam o `state`. Internamente, cada `addX`/`updateX`/`removeX` passa a disparar uma escrita assíncrona no Firestore (`addDoc`/`updateDoc`/`deleteDoc`); a UI não precisa aguardar essas promises porque o listener em tempo real atualiza o estado local e chama `notify()` assim que a escrita é confirmada pelo servidor — o mesmo padrão pub/sub que já existe hoje.

## Modelo de dados (Firestore)

Estrutura multi-organização: cada clínica é uma organização com seu próprio espaço de dados, isolado das demais.

- `organizations/{orgId}` — um documento por clínica. `orgId` é um **código curto e memorável escolhido pelo administrador** ao criar a clínica manualmente no Console (ex: `duovet`), não um id gerado aleatoriamente — isso permite que o próprio código sirva como "código da clínica" digitado no cadastro, sem precisar de nenhuma consulta/busca. Contém um campo `nome` (nome de exibição da clínica).
- `organizations/{orgId}/allowlist/{email}` — subcoleção com um documento por email autorizado a se cadastrar **naquela** clínica (id do documento = email em minúsculas). Criada manualmente pelo administrador no Console — não há tela no app para gerenciar essa coleção.
- `organizations/{orgId}/patients/{id}`, `.../transactions/{id}`, `.../despesas/{id}`, `.../appointments/{id}`, `.../categories/{id}`, `.../eventTypes/{id}` — subcoleções com a mesma estrutura de campos de hoje (ex: `patients` mantém `nomePet`, `especie`, `raca`, `idade`, `peso`, `sexo`, `tutorNome`, `tutorTelefone`, `tutorCpf`, `internado`, `obito`, `consultas[]`, `vacinas[]`, `vermifugos[]`), com `vetId` agora igual ao `uid` real do Firebase Auth de quem criou o paciente (era um id local gerado pelo app).
- `users/{uid}` — perfil **global** do veterinário (campos `nome`, `email`, `orgId`), documento id = uid do Firebase Auth. Criado automaticamente no cadastro bem-sucedido; é o único lugar que diz "a qual clínica este usuário pertence" — por isso vive fora de qualquer organização, para ser consultado logo após o login, antes de sabermos o `orgId`.

Datas (`consultas[].data`, `vacinas[].data`/`.proximaDose`, `vermifugos[].data`) continuam armazenadas como estavam (strings ISO ou `Timestamp` do Firestore, convertidas para `Date` do JS na leitura, igual ao padrão já usado com `localStorage`).

## Autenticação e segurança

**Cadastro (uma vez só, por veterinário):** o veterinário abre o site, escolhe "Criar conta", informa nome + email + senha + **código da clínica** (dado a ele pelo administrador quando entra na equipe — é o `orgId`, ex: `duovet`). O app chama `createUserWithEmailAndPassword` do Firebase Auth e, em seguida, tenta criar o documento `users/{uid}` com `{ nome, email, orgId }`.

**Login (dia a dia):** só email + senha — o código da clínica não é pedido de novo. Depois de autenticar, o app lê `users/{uid}` para descobrir `orgId` e a partir daí liga a sincronização em tempo real das subcoleções daquela organização.

As regras de segurança do Firestore (não apenas uma checagem em JavaScript, que poderia ser contornada chamando a API diretamente) fecham o fluxo:
- Criar o documento `users/{uid}` só é permitido se existir um documento correspondente em `organizations/{orgId informado}/allowlist/{email do usuário autenticado}` — ou seja, mesmo que alguém crie uma conta de login no Firebase Auth sem estar na allowlist de nenhuma clínica, essa conta nunca ganha um perfil em `users/` e fica sem acesso a nenhum dado.
- Ler ou escrever qualquer coisa dentro de `organizations/{orgId}/**` só é permitido para usuários autenticados cujo `users/{uid}.orgId` seja igual a esse `orgId` — isolando completamente os dados de clínicas diferentes.
- As subcoleções `allowlist` não são legíveis nem escrevíveis pelo cliente (só editadas manualmente pelo administrador no Console do Firebase).

**Mudança de comportamento em relação à versão anterior:** como os dados (inclusive financeiro/agenda) agora são reais e protegidos por regras do Firestore, o **login passa a ser exigido para o app inteiro** ao abrir o site — não mais só para a aba Pacientes. A sessão persiste entre recarregamentos de página (também uma mudança deliberada: a versão anterior sempre "esquecia" o login ao dar F5) — o veterinário só sai ao clicar em "Sair" explicitamente.

## Estados de carregamento e erro

Como os dados agora vêm de rede (assíncronos), cada aba mostra um estado de carregamento simples ("Carregando...") enquanto os dados iniciais chegam do Firestore. Se não houver conexão com a internet ou o Firebase estiver inacessível, o app mostra uma mensagem de erro genérica ("Sem conexão — verifique sua internet e recarregue a página") no lugar do conteúdo da aba afetada, em vez de travar silenciosamente.

## Publicação

**GitHub:**
- Inicializar um repositório git local no projeto (`vet-dashboard` ainda não é um repositório git).
- Criar um repositório no GitHub (público — GitHub Pages gratuito exige repositório público; não há segredos no código, já que as chaves de configuração do Firebase são identificadores públicos do projeto, não credenciais).
- Habilitar GitHub Pages apontando para a branch principal.

**Firebase (etapas manuais, feitas pelo usuário via Console, com um guia passo a passo em `README.md`):**
1. Criar um projeto no Firebase (plano gratuito "Spark").
2. Ativar Firestore Database e Authentication → método Email/senha.
3. Copiar as chaves de configuração do projeto para colar no código.
4. Publicar as regras de segurança do Firestore (fornecidas prontas).
5. Criar o documento `organizations/duovet` (campo `nome: "DuoVet"`) — a primeira organização.
6. Criar a subcoleção `organizations/duovet/allowlist/{email}` com um documento para cada veterinário da clínica (Dr. Antonio, Dra. Iara, Dr. Nag).

## Fora do escopo — decisões explícitas

- Sem migração de dados de teste do localStorage atual: o Firestore começa vazio.
- Sem Cloud Functions: toda a lógica de segurança fica nas regras do Firestore (declarativas), sem servidor próprio.
- Sem recuperação de senha/verificação de email: apenas criar conta (gated por allowlist) e login.
- Sem tela de autocadastro de organização: novas clínicas são criadas manualmente pelo administrador no Console do Firebase (repetindo os passos 5 e 6 acima com um novo código de organização).
- Um usuário pertence a exatamente uma organização, definida no cadastro; não há troca de organização depois.
