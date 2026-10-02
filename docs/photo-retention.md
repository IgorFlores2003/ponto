# Fotos: armazenamento e retenção

O destino preparado é o **Supabase Storage privado**, bucket `ponto-fotos`. O backend já suporta esse modo, mas depende de `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e da configuração do bucket. Sem `PHOTO_STORAGE=supabase`, as fotos continuam no PostgreSQL como dados inline; não ficam no APK nem no disco da Vercel.

Para ativar o Storage, siga `docs/supabase.md`, execute `npm run supabase:storage:setup` e configure `PHOTO_STORAGE=supabase` no backend. Para fotos antigas, simule com `npm run photos:migrate` e aplique com `npm run photos:migrate -- --apply` quando o Storage estiver configurado.

## Dois meses, somente fotos

São elegíveis fotos de batidas com `occurred_at` anterior a dois meses de calendário e fotos de perfil cuja última atualização tem mais de dois meses. Pontos, funcionários, valores e relatórios não são apagados.

A migration 017 registra a data das fotos de perfil existentes como a data de implantação, pois a data original do upload não era armazenada. As novas fotos usam sua data de cadastro/atualização. A janela usa UTC, com ajuste para o último dia de meses mais curtos.

```sh
npm run photos:prune             # Simulação
npm run photos:prune -- --apply  # Aplica um lote
```

Cada execução processa até 200 fotos por tabela e até 200 objetos do Storage, respeitando um orçamento de tempo de 40 segundos. O banco remove a referência e cria uma tarefa persistente de exclusão na mesma transação. Se o Storage falhar, a tarefa permanece para a próxima execução. Objetos ainda referenciados por outra foto são preservados. Consulte os campos `failed`, `pending` e `found` no resultado para identificar falhas ou acúmulo de fotos a limpar; execute lotes adicionais se necessário.

## Agendamento de produção

`vercel.json` inclui uma chamada diária às 05:00 UTC para `/api/maintenance/photos`. Configure um `CRON_SECRET` aleatório e longo na Vercel e faça redeploy. O endpoint recusa chamadas sem o segredo correto. Sem deploy e sem esse segredo, a limpeza automática não está ativa. O ambiente local pode executar o CLI por um agendador externo.

A limpeza do servidor não elimina cópias baixadas por usuários, backups externos ou imagens já abertas em dispositivos. URLs assinadas já emitidas expiram em até uma hora; a remoção física do objeto depende de a tarefa do Storage ser concluída.

Referência: [agendamentos da Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
