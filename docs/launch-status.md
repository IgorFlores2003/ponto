# Preparação da versão Android 1.1

## Implementado e validado localmente

- Cadastro com confirmação por código e aprovação administrativa; mantém o administrador local existente.
- Troca de senha autenticada e recuperação por e-mail para contas do Supabase Auth.
- Exportação XLSX para Excel/Sheets, além de CSV e PDF.
- Tarifa normal e extra por funcionário; valores e total trabalhado nos relatórios.
- Retenção de fotos de batidas e perfil por dois meses, sem excluir pontos/relatórios; fila de nova tentativa para exclusões no Storage.
- APK e AAB assinados, versão 1.1 (código 2).
- Migrations até 018 aplicadas no Supabase configurado; RLS conferido nas 12 tabelas do aplicativo.
- Testes automatizados de acesso, senhas, retenção e planilha com banco em memória e Auth simulado.

## Configuração externa pendente

1. Preencher `SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SECRET_KEY` no `.env` com as chaves reais do projeto.
2. Contratar/configurar um provedor SMTP e remetente autorizado. Preencher as variáveis `SMTP_*` e o token de gerenciamento para executar `npm run supabase:smtp:setup`.
3. Criar/verificar o bucket privado com `npm run supabase:storage:setup`. Só então ativar `PHOTO_STORAGE=supabase`.
4. Depois do teste real de e-mail, ativar `ADMIN_REGISTRATION_ENABLED=true`. O login local continua funcionando enquanto o cadastro está desativado.
5. Executar `npm run env:check -- --write-vercel` após mudar o `.env`. O arquivo privado `release-private/vercel.env` contém a configuração de produção para importar na Vercel, sem as credenciais temporárias de gerenciamento/SMTP.
6. Publicar o backend atualizado e configurar `CRON_SECRET` na Vercel. O agendamento de retenção só funciona no ambiente publicado.
7. Testar no aparelho: cadastro → código de e-mail → aprovação → login → troca/recuperação de senha → batida → exportação para Excel/Sheets. O emulador existente tem assinatura diferente; não foi desinstalado nem teve dados apagados.

O Supabase verificado tem um administrador e nenhum funcionário no momento desta revisão. Ainda não foi confirmado se a API já publicada na Vercel usa esse mesmo banco.

## Limitações de validação

Os testes de e-mail usam respostas simuladas; não houve envio real. A geração e releitura do XLSX foram testadas por biblioteca, sem abrir em um Excel/Sheets instalado. O build Android foi concluído; a instalação no emulador foi bloqueada pela assinatura de uma versão antiga.

`npm audit` apontou dependências com alertas moderados (`uuid`, por ExcelJS e ferramentas iOS do Capacitor) e um alerta baixo em DOMPurify. Não foi executado `audit fix --force`. A biblioteca de planilhas é carregada apenas ao exportar e gera um chunk de aproximadamente 930 KB, comprimido para aproximadamente 256 KB.

Guias: [acesso e SMTP](auth-email.md), [fotos](photo-retention.md), [Android](android-release.md).
