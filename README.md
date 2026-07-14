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

## Publicação (GitHub Pages)

Qualquer `git push` para a branch `main` atualiza o site publicado em `https://<usuário-github>.github.io/vet-dashboard/`.
