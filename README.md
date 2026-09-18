# Ponto Digital

Protótipo mobile-first de um aplicativo de controle de ponto com autenticação biométrica.

## Rodar localmente

```bash
npm install
npm run dev
```

O protótipo salva os registros no `localStorage` do navegador. A biometria exibida na interface representa o fluxo de autenticação do dispositivo; em produção, a implementação deve usar Face ID, Touch ID ou Android Biometric Prompt via uma camada nativa, mantendo os dados biométricos no sistema operacional.

## Próximos passos

- integrar autenticação real do dispositivo com Capacitor, React Native ou Flutter;
- criar API com usuários, empresas, jornadas e registros;
- sincronizar os pontos com o servidor e aplicar regras de alteração e aprovação;
- adicionar painel administrativo e exportação de relatório.
