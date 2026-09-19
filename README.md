# Ponto Digital

React + Vite, backend Express no mesmo projeto e PostgreSQL/Supabase ou SQLite com Knex. Duas interfaces independentes compartilham a API:

- `/#/terminal`: terminal do funcionário, apenas para marcar ponto por PIN.
- `/#/admin`: login administrativo, cadastro de funcionários, dashboard e relatórios.

## Iniciar

Use Node.js 22.12+ ou 24+.

```bash
npm install
npm run admin:create
npm run dev
```

`admin:create` solicita usuário e senha (mínimo 10 caracteres, sem exibir a senha no terminal). O comando não usa senha padrão. Para dados de demonstração, veja a seção de seeds. Execute o comando com o mesmo `DATABASE_PATH` usado pelo backend. É possível criar outros administradores pelo mesmo comando.

Abra a URL do Vite e acrescente `/#/admin` para entrar. Cadastre os funcionários e seus PINs exclusivos. Por exemplo: Igor com `1234` e Yasmim com `2344` (esses exemplos podem ser criados com `npm run db:seed`).

## Funcionário

Abra `/#/terminal` no aparelho compartilhado. Digite o PIN e clique em **Marcar ponto**. O backend identifica o funcionário pelo PIN, define o horário e registra a batida. O campo é apagado após cada tentativa; não há sessão de funcionário. A confirmação desaparece após 6 segundos.

No modo automático:

- Sem jornada aberta, registra entrada.
- Em expediente, registra saída.
- Em intervalo, registra retorno do intervalo.

Para fazer uma pausa, selecione **Iniciar intervalo** antes de digitar o PIN e marcar. Também é possível selecionar explicitamente entrada, saída ou retorno. A API valida a sequência. Envios repetidos com o mesmo identificador não duplicam batidas; novas batidas para a mesma pessoa exigem intervalo mínimo de 5 segundos.

O terminal não tem acesso à lista de funcionários, históricos ou relatórios. O PIN é sempre necessário e o backend ignora qualquer identificação de funcionário enviada pelo terminal.

## Administrador

Após login, o administrador pode:

- Ver e cadastrar todos os funcionários, com matrícula única, departamento, jornada e PIN de 4 números.
- Definir ou trocar o PIN de qualquer funcionário. PINs devem ser exclusivos, inclusive quando começam com zero.
- Consultar dashboard de horas e batidas por período, horas por funcionário e situação atual da equipe.
- Consultar relatório de todos ou de um funcionário, histórico de batidas e exportação CSV.
- Encerrar a sessão pelo botão **Sair da conta**.

Funcionários existentes e seus históricos são preservados pelas migrations. Cadastros anteriores ficam com **PIN pendente** até o administrador definir um PIN.

As horas descontam intervalos e dividem expedientes que atravessam a meia-noite. Incluem jornadas abertas até a atualização do relatório. Datas e horários são apresentados em Brasília. Os relatórios mostram horas trabalhadas, sem inferir horas extras ou faltas a partir da meta diária. Use **Atualizar** para buscar novas batidas.

## Validação e produção

```bash
npm test
npm run build
npm start
```

`npm run dev` inicia frontend e API juntos. A API usa a porta 3001; o Vite encaminha `/api` para ela. `npm start` serve o frontend compilado e a API em `http://127.0.0.1:3001`.

As migrations são aplicadas na inicialização. Com `DATABASE_URL` no `.env`, usa PostgreSQL. Sem essa variável, usa `data/ponto.sqlite`. Faça backup com ferramenta compatível com SQLite ou com o servidor parado, incluindo eventuais arquivos WAL/SHM.

## Configuração e Android

- `PORT`: porta do backend, padrão 3001.
- `HOST`: endereço de escuta, padrão `127.0.0.1`; use `0.0.0.0` para acesso pela rede.
- `DATABASE_URL`: conexão PostgreSQL, carregada do `.env` apenas no backend.
- `DATABASE_CA_PATH`: certificado CA para TLS, por exemplo `server/certs/supabase.crt`.
- `DATABASE_PATH`: caminho do banco SQLite, usado quando não há `DATABASE_URL`.
- `CORS_ORIGINS`: origens permitidas separadas por vírgula; inclui as origens locais do Capacitor por padrão.
- `VITE_API_URL`: URL da API no build, por exemplo `https://seu-servidor.example/api`; configure em `.env.local`.

As duas interfaces estão no mesmo frontend, com URLs separadas e permissões aplicadas no servidor. Não são dois APKs separados. O backend roda em Node, não dentro do APK. Para Android, configure `VITE_API_URL`, execute `npm run build` e `npx cap sync android`. O aplicativo abre o terminal por padrão. O backend deve estar acessível pelo aparelho.

## Autenticação

Senhas administrativas usam scrypt com salt; PINs usam digest HMAC com chave aleatória persistida no banco e nunca são retornados pela API. Sessões administrativas duram 8 horas, são revogadas no logout e têm apenas o hash do token salvo no banco. O frontend mantém o token apenas em memória: recarregar a página exige novo login.

Login e terminal possuem limite de tentativas persistido por IP (10 por 15 minutos e 30 por minuto, respectivamente). Atrás de proxy, por padrão o limite considera o IP do proxy. Use HTTPS ao disponibilizar acesso remoto. O PIN tem apenas 4 números e é adequado ao fluxo solicitado de terminal compartilhado; mantenha o banco e o acesso ao terminal protegidos.

## API

Públicas:

- `POST /api/auth/login`: `username`, `password` → token administrativo.
- `POST /api/terminal/punch`: `pin`, `kind` (padrão `auto`), `request_id` (UUID por tentativa lógica).

Exclusivas do administrador, com `Authorization: Bearer <token>`:

- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/employees`
- `POST /api/employees`: `name`, `registration`, `pin`, `department` opcional, `target_hours` padrão 8.
- `POST /api/employees/:id/pin`: `pin`.
- `GET /api/employees/:id/entries`
- `GET /api/reports?from=AAAA-MM-DD&to=AAAA-MM-DD`

A antiga rota de registro por ID foi removida: batidas só são aceitas pelo terminal mediante PIN. Registros não podem ser excluídos pela API.

## Seeds de desenvolvimento

```bash
npm run db:seed
```

Aplica as migrations e executa os seeds nativos do Knex no banco configurado em `DATABASE_URL`, ou em `DATABASE_PATH` para SQLite. Cria:

| Acesso | Usuário / funcionário | Senha / PIN |
| --- | --- | --- |
| Administrador | admin | Admin@12345 |
| Funcionário | Igor (DEMO-001) | 1234 |
| Funcionário | Yasmim (DEMO-002) | 2344 |

Pode executar novamente: não duplica matrículas nem altera senhas, funcionários ou batidas existentes. Se `admin` já existe, sua senha continua a mesma. Se uma matrícula de demonstração já existe, seu cadastro é mantido. Se um PIN estiver ocupado por outra matrícula, o seed falha e desfaz todas as inserções daquela execução. Não cria batidas fictícias. A execução é bloqueada com `NODE_ENV=production`; as credenciais acima são apenas para desenvolvimento.

## Supabase / PostgreSQL

Configure `DATABASE_URL` e `DATABASE_CA_PATH` no `.env` (ignorado pelo Git). Nunca use prefixo `VITE_` em credenciais de banco. As variáveis já presentes no ambiente têm prioridade. Execute `npm run db:migrate` para aplicar as migrations e `npm run db:seed` para os acessos de demonstração, quando apropriado.

A conexão usa TLS com validação de certificado e hostname. A CA pública em `server/certs/supabase.crt` foi obtida em https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt. Consulte a [documentação SSL do Supabase](https://supabase.com/docs/guides/platform/ssl-enforcement) para renovação do certificado.

As migrations ativam RLS nas tabelas do aplicativo e revogam acesso dos papéis públicos `anon` e `authenticated`; somente o backend acessa os dados. Os bloqueios de batidas e de tentativas usam transações, compatíveis com o pooler na porta 6543. O suporte a SQLite permanece para desenvolvimento e testes. Os testes passam caminhos explícitos temporários, sem acessar o banco remoto.

A troca de configuração não copia funcionários ou batidas já existentes no arquivo SQLite para o Supabase.

## Publicar na Vercel

O projeto inclui `vercel.json` para servir o frontend Vite e encaminhar `/api/*` à função Express em `api/index.js`. O backend reutiliza o pool PostgreSQL e não executa migrations ou seeds durante requisições. Mantenha as migrations atualizadas com `npm run db:migrate` antes de publicar mudanças de schema.

Na Vercel, use a raiz do repositório e Node.js 22.x. Configure `DATABASE_URL`, `DATABASE_CA_PATH=server/certs/supabase.crt` e `NODE_ENV=production`. O certificado é incluído na função; arquivos `.env` e bancos locais são excluídos do upload. Não configure `VITE_API_URL` para o frontend web: ele usa `/api` no mesmo domínio. Para compilar Android, configure essa variável localmente com a URL pública da Vercel seguida de `/api`.

A instalação usa `npm ci --include=dev` para incluir os tipos do React e as ferramentas de build mesmo em ambiente de produção. O build força uma nova checagem TypeScript, sem reutilizar arquivos `.tsbuildinfo`. Após enviar as alterações ao GitHub, execute um novo deploy na Vercel.
