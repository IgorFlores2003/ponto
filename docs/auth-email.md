# Cadastro, confirmação e senhas

O cadastro é aberto, mas só concede acesso à empresa depois de confirmar o e-mail e receber aprovação de um administrador. Todos os administradores aprovados acessam os mesmos funcionários e relatórios: não existe separação de empresas neste projeto.

## Fluxo no aplicativo

1. Na área administrativa, escolha **Criar conta** e informe nome, e-mail e senha.
2. Digite o código recebido por e-mail. É possível reenviar o código ou voltar à confirmação posteriormente.
3. Um administrador atual entra no dashboard, abre **Aprovar novos administradores** e aprova ou recusa o cadastro. A API confere novamente a confirmação no Supabase antes de aprovar.
4. Após aprovação, entre com e-mail e senha. Cadastros pendentes ou recusados não recebem acesso administrativo nem ao terminal local.

O administrador criado pelo seed continua entrando com seu usuário atual. A opção **Mudar minha senha** exige a senha atual e encerra suas sessões administrativas e de terminal. **Esqueci minha senha** envia um código aos usuários cadastrados por e-mail; o administrador local criado pelo seed não tem e-mail verificado e não recebe recuperação por e-mail. Para usar recuperação, cadastre e aprove uma conta com e-mail pelo fluxo acima.

## Ativar Supabase Auth e SMTP

As migrations até a 018 precisam ser aplicadas antes de implantar o backend desta versão. O cadastro vem desativado até a configuração estar pronta; o botão apresenta uma mensagem de indisponibilidade nesse caso.

Configure no `.env` e no backend da Vercel:

```dotenv
SUPABASE_URL=https://zykhbdburnvxxbvpryei.supabase.co
SUPABASE_PUBLISHABLE_KEY=CHAVE_PUBLICA_DO_PROJETO
SUPABASE_SECRET_KEY=CHAVE_SECRETA_DO_PROJETO
AUTH_SESSION_ENCRYPTION_KEY=CHAVE_DE_64_CARACTERES_HEXADECIMAIS
ADMIN_REGISTRATION_ENABLED=true
```

A chave de criptografia deve ser a mesma em todas as instâncias e não deve ser regenerada a cada deploy. Nunca coloque chaves do backend em variáveis `VITE_`.

Para configurar o envio, obtenha uma conta em um provedor SMTP, um remetente autorizado por ele e as credenciais. No `.env` local, defina:

```dotenv
SUPABASE_PROJECT_REF=zykhbdburnvxxbvpryei
SUPABASE_ACCESS_TOKEN=TOKEN_PESSOAL_DE_GERENCIAMENTO_SUPABASE
SMTP_HOST=HOST_DO_PROVEDOR
SMTP_PORT=587
SMTP_USER=USUARIO_SMTP
SMTP_PASSWORD="SENHA_SMTP"
SMTP_FROM=REMETENTE_AUTORIZADO
SMTP_SENDER_NAME=Ponto Digital
```

Execute `npm run supabase:smtp:setup`. O comando configura o SMTP no Supabase, exige confirmação de e-mail e instala modelos em português com código de confirmação e de recuperação. Não modifica as URLs de redirecionamento nem remove outros provedores. O aplicativo usa códigos digitados na própria tela, sem depender de links para reabrir o Android.

O token de gerenciamento e a senha SMTP são necessários apenas no computador para configurar o Supabase; não são necessários na Vercel nem no APK. Remova essas credenciais temporárias do ambiente após configurar. Não compartilhe senhas no chat.

Sem provedor/remetente e as chaves do Supabase, os envios reais não podem ser ativados. O SMTP padrão do Supabase serve para testes restritos e não substitui o serviço de produção. O script confirma a configuração pela API, mas a entrega deve ser validada com um cadastro e uma recuperação reais.

## Verificação

`npm test` exercita cadastro, aprovação, autenticação, troca/recuperação de senha e isolamento de sessões usando Supabase simulado e SQLite em memória. Esses testes não comprovam a entrega de e-mail real. Depois de publicar, teste os fluxos com uma caixa de e-mail sua e confirme que o acesso continua bloqueado antes da aprovação.

Referências: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [senhas](https://supabase.com/docs/guides/auth/passwords) e [modelos de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates).
