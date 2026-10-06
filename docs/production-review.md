# Revisão de prontidão para produção — 2026-10-06

Parecer: ainda não aprovar a versão atual para produção. Os testes abaixo validam partes importantes, mas não substituem homologação do deploy e dos dispositivos reais.

## Validações concluídas

- Build TypeScript/Vite aprovado; permanecem avisos de bundles maiores que 500 kB.
- Seis testes automatizados aprovados, com múltiplas verificações: seed idempotente, cadastro Ponto, autenticação local e Supabase simulado, permissões, logout, expiração, troca de senha, rate limit, funcionário inativo, idempotência das batidas, fechamento por fuso, tarifas normais/extras, valores ausentes, CSV, XLSX e geração de PDF com várias páginas.
- Testes de integração usam SQLite temporário; não fazem inserções no banco real. Supabase Auth é simulado nos testes.
- Supabase real: conexão OK, RLS habilitado nas 14 tabelas verificadas, bucket configurado privado e nenhuma migration pendente. A presença de RLS não equivale a uma auditoria completa de todas as policies e grants.
- Aplicação publicada em https://ponto-rho-seven.vercel.app: página inicial e endpoints de configuração retornam 200; endpoints de funcionários e sessão do terminal retornam 401 sem autenticação.
- `git diff --check` aprovado.

## Correções feitas nesta revisão

1. `server/app.js`: consulta do relatório usava meia-noite UTC como fim do período. Reproduzido um caso com saída às 22h de Brasília que calculava quatro horas em vez de duas. A consulta agora termina na meia-noite de Brasília, com limite exclusivo. Teste de regressão aprovado.
2. `src/TerminalAccess.tsx`: cadastro e recuperação por e-mail só aparecem quando habilitados na configuração do servidor.
3. `server/check-db.js`: verificação de RLS passou a incluir `ponto_users` e `ponto_sessions`.
4. Atualizadas somente as dependências transitivas `dompurify` (3.4.16) e `source-map-js` (1.2.2), removendo os alertas identificados nessas versões anteriores. Não foi executado `npm audit fix --force`.

## Pendências antes da liberação

### Alta prioridade

- **Foto obrigatória somente no frontend:** `src/Terminal.tsx` exige câmera, mas `server/app.js` aceita batidas autenticadas sem foto. Os testes de integração também reproduzem esse comportamento. Se a foto é requisito, a API precisa exigi-la; caso contrário, o controle pode ser contornado por uma chamada direta.
- **Análise de foto sem garantia de conclusão na Vercel:** `server/app.js` inicia uma Promise sem await e responde imediatamente. Não há `waitUntil` nem fila persistente. Há risco de análises permanecerem pendentes. Referência oficial: https://vercel.com/kb/guide/troubleshooting-inconsistent-logs-in-vercel-functions . É necessária integração ao ciclo de vida da função e/ou fila com retentativas, seguida de teste no deploy.
- **Auditoria npm com pendências:** após as duas atualizações, `npm audit` reportou seis pacotes afetados: dois críticos (`shell-quote` e seu dependente `concurrently`, usados no desenvolvimento) e quatro moderados (`uuid`, `exceljs`, `xcode`, `@capacitor/cli`). Esses números incluem dependentes de uma mesma vulnerabilidade; não significam seis falhas independentes. No código instalado, ExcelJS usa `uuid.v4`, enquanto o aviso de uuid cita outras variantes; a exploração no fluxo atual não foi demonstrada. É necessário resolver ou documentar formalmente a exposição antes da liberação, sem downgrade automático das bibliotecas.

### Homologação e operação

- **Deploy não equivale ao código local:** a versão publicada informa `registration_enabled: true`; o ambiente local está com cadastro desativado. As correções desta revisão não foram publicadas.
- **Cabeçalhos de segurança:** nas respostas consultadas da Vercel não vieram CSP nem `X-Content-Type-Options`. O Helmet está em `server/index.js`, após a criação das rotas, e não é instalado pelo entrypoint da Vercel. Revisar os cabeçalhos tanto para frontend quanto API.
- **Proxy e rate limit:** o limitador usa `req.ip`. `TRUST_PROXY` não está definido no ambiente local. Validar a identificação real de IPs no deploy para evitar limite compartilhado entre usuários. Não habilitar confiança irrestrita em cabeçalhos enviados pelo cliente.
- **Conta Ponto:** existe criação, mas não há opção administrativa de desativar uma conta ou redefinir sua senha. A coluna `active` é respeitada pelo backend, porém falta operação na interface.
- **Pagamentos:** mantida a regra existente de extras somente nas folgas; excedente de jornada em dia normal não é classificado como extra. Valores usam tarifas atuais, portanto alterações recalculam períodos passados. Não existe fechamento mensal imutável. Validar se isso atende ao processo de pagamento.
- **Câmera e dispositivos:** não foram realizados testes reais de câmera, permissões Android/iOS, compartilhamento/download nativo ou inspeção visual do PDF em um leitor. A geração e os valores dos arquivos foram testados automaticamente.
- **Ambiente de execução:** testes executados com Node 24.14.1; projeto declara Node 22.x. Repetir na versão do runtime de produção.
- **Operação:** execução do cron, recuperação de backup, concorrência no PostgreSQL e carga não foram testadas. A revisão do Supabase foi somente leitura e não testou upload/download real de foto.

## Testes adicionados

- `tests/production-flows.test.mjs`: fechamento por fuso e regressões de API.
- `tests/report-exports.test.mjs`: valores em XLSX, proteção de CSV e PDF multipágina.

Suíte completa: `npm test`. Build: `npm run build`.
