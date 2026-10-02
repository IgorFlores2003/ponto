# Lançamento Android

O aplicativo usa `VITE_API_URL` no momento do build. A configuração local atual aponta para `https://ponto-rho-seven.vercel.app/api`. Alterar `DATABASE_URL` no computador não altera o banco da API publicada: configure a variável no projeto Vercel e publique uma nova implantação para aplicá-la.

## Gerar os arquivos

Com Node, Android SDK e Java compatível com o projeto instalados:

```sh
npm ci
npm test
npm run android:release
```

O comando valida o endereço HTTPS da API, atualiza o frontend no Android e gera os dois arquivos assinados:

- APK para instalação direta: `android/app/build/outputs/apk/release/app-release.apk`.
- AAB para envio à Play Store: `android/app/build/outputs/bundle/release/app-release.aab`.

O identificador é `com.pontodigital.app`; esta versão usa `versionCode 2` e `versionName 1.1`. Aumente `versionCode` em `android/app/build.gradle` a cada atualização publicada.

## Assinatura e backup

A chave está em `release-private/ponto-digital-release.jks`. O arquivo `android/keystore.properties` contém o caminho, alias e senhas. Ambos são privados e ignorados pelo Git. Guarde uma cópia segura dos dois antes de distribuir o APK. Reutilize a mesma chave nas atualizações; não execute uma nova geração por cima dela.

Em outra máquina, restaure ambos os arquivos nas mesmas posições. Formato de `android/keystore.properties`:

```properties
storeFile=../release-private/ponto-digital-release.jks
storePassword=SENHA_DA_CHAVE
keyAlias=ponto-digital
keyPassword=SENHA_DA_CHAVE
```

## Validar o lançamento

1. Confirme que a API publicada usa o projeto Supabase esperado. Não copie credenciais do banco para variáveis `VITE_`.
2. Com o `.env` apontando para esse mesmo banco, execute `npm run db:migrate` e `npm run db:check`.
3. Se não houver administrador, execute `npm run admin:create`. Não use os seeds de demonstração no banco de produção.
4. Instale o APK em um aparelho, faça login, cadastre um funcionário, libere o terminal e registre uma batida. Confira funcionário e batida no banco esperado.
5. Teste câmera, permissões, exportação de relatório e reabertura do aplicativo. O app depende de conexão com a API.

O build e a assinatura não publicam o aplicativo na Play Store. A publicação e os formulários da loja ainda precisam ser concluídos na conta do responsável, com as informações reais de suporte, privacidade e tratamento dos dados.
