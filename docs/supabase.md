# Supabase para uma empresa

Fluxo: aplicativo/site → API Express → PostgreSQL, Supabase Auth e Storage privado.
O backend ainda precisa de hospedagem; esta integração não cria infraestrutura AWS nem muda a hospedagem existente.

- PostgreSQL mantém funcionários, batidas, escalas e os caminhos das fotos.
- Storage guarda os arquivos em `ponto-fotos`, um bucket privado.
- Supabase Auth valida o login que libera o **terminal**. Depois de entrar, cada funcionário continua usando sua senha de quatro números para bater ponto.
- O **painel administrativo mantém o usuário e a senha atuais**, em um login separado. Novas contas por e-mail podem ser habilitadas com confirmação e aprovação, conforme [cadastro e senhas](auth-email.md). A sessão do terminal nunca autoriza cadastros, fotos, notificações ou relatórios administrativos.
- A conta do Supabase Auth precisa ser vinculada a `terminal_users`. Uma conta qualquer do mesmo projeto não libera este terminal. O campo `active=false` bloqueia o acesso.
- O aplicativo recebe somente uma sessão opaca de oito horas. Tokens do Supabase ficam criptografados no backend, com renovação automática e verificação do usuário no Auth. Logout encerra a sessão local e tenta revogar também a sessão remota. As sessões de terminal e admin usam tabelas e chaves de armazenamento distintas.
- Fotos são acessadas por URLs assinadas de uma hora, emitidas após autorização administrativa. O arquivo é baixado diretamente do Storage; credenciais e uploads ficam no backend. Quem possuir uma URL assinada pode acessar aquela foto até ela expirar.

## Configurar e ativar

Os padrões são `TERMINAL_AUTH_PROVIDER=local` e `PHOTO_STORAGE=database`. Assim, enquanto configura o Supabase, o novo login do terminal aceita as credenciais administrativas existentes, mas gera uma sessão **restrita ao terminal**. O painel continua exigindo seu próprio login. Não existe terminal público sem autenticação.

1. Confira um backup do banco atual. Backups de PostgreSQL não incluem os arquivos do Storage; configure também a cópia dos objetos separadamente.
2. Configure no ambiente **do backend** as chaves do mesmo projeto Supabase que contém o banco:

   ```dotenv
   SUPABASE_URL=https://SEU-PROJETO.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   SUPABASE_STORAGE_BUCKET=ponto-fotos
   AUTH_SESSION_ENCRYPTION_KEY=CHAVE_ALEATORIA_DE_64_CARACTERES_HEXADECIMAIS
   ```

   As chaves legadas `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` também são aceitas. Preserve `DATABASE_URL` e `DATABASE_CA_PATH`. Nunca envie essas credenciais ao Git, navegador ou APK. Gere a chave de criptografia no seu ambiente seguro com `openssl rand -hex 32`; todas as instâncias do backend precisam da mesma chave. Trocá-la encerra as sessões do terminal existentes.

3. Execute `npm run db:migrate` no banco correto. A migration 015 cria `terminal_users` e `terminal_sessions`, protegidas contra acesso direto pelos papéis públicos do Supabase. Os administradores e históricos existentes permanecem intactos. No Vercel, execute as migrations separadamente do deploy.
4. Execute `npm run supabase:storage:setup`. O comando cria o bucket privado ou verifica o bucket existente. Não adicione políticas públicas de leitura/escrita: o backend usa a chave secreta. O aplicativo aceita fotos de até 250 KB.
5. Ative `PHOTO_STORAGE=supabase` no backend e reinicie/reimplante. Novas fotos vão para o Storage. Confira um cadastro, uma batida e a abertura da foto no admin.
6. Confira as fotos antigas com `npm run photos:migrate` (somente contagem). Depois execute `npm run photos:migrate -- --apply`. A migração envia e baixa cada arquivo para comparar seu hash antes de trocar a foto inline pelo caminho. Alterações concorrentes são preservadas. O processo pode ser retomado; fotos já migradas não são reenviadas. Em caso de falha, os originais ainda não migrados permanecem no banco.
7. Em Supabase → Authentication, crie a conta que poderá liberar o terminal e confirme o e-mail. Copie seu User UID e vincule:

   ```bash
   npm run supabase:terminal:link -- --name recepcao --user-id UUID-DO-USUARIO
   ```

   Esse comando verifica a conta remota e cria o vínculo do terminal. Não cria nem altera contas administrativas.
8. Ative `TERMINAL_AUTH_PROVIDER=supabase`, reinicie/reimplante e entre na tela inicial com o e-mail e a senha do Auth. As credenciais administrativas locais deixam de liberar o terminal, mas continuam funcionando no painel administrativo.
9. Confira: login do terminal → batida com PIN → sair do terminal; e, separadamente, login administrativo → cadastros, fotos, notificações e relatórios. Gere uma nova versão Android com `npm run android:sync`, pois o login antes do terminal modifica o frontend. Mantenha `VITE_API_URL` apontando para a API HTTPS.

## Publicação coordenada

O backend passa a exigir autenticação em `/api/terminal/punch` e `/api/terminal/break-rules`. APKs antigos não enviam a sessão do terminal e deixarão de bater ponto. Atualize o aplicativo dos aparelhos da empresa junto com a API, em uma janela combinada. Para voltar uma versão, volte frontend e backend juntos.

Auth e Storage não são ativados automaticamente: faltam as chaves, o bucket, a migration e o vínculo descritos acima. Caso o provedor remoto falhe depois da ativação, a API informa indisponibilidade; não troca automaticamente para senhas locais nem grava novas fotos no banco. Após migrar fotos, mantenha o Storage configurado para abri-las.

## Operação

Fotos substituídas ou de funcionários excluídos são removidas do Storage após a alteração no banco. Se a limpeza remota falhar, poderá sobrar um objeto sem referência; o servidor registra um aviso para revisão. A rotina de retenção de dois meses para fotos e seu agendamento estão descritos em [retenção de fotos](photo-retention.md).

Atrás de um único proxy confiável, configure `TRUST_PROXY=1` e restrinja a porta Node ao proxy. Isso permite limitar tentativas pelo IP real. Mantenha HTTPS, cópias dos dados e alertas de indisponibilidade.

Referências oficiais:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://supabase.com/docs/guides/storage/serving/downloads
