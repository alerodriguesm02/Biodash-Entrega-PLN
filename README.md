# Biodash-Entrega-PLN

Aplicação BioDash unificada para deploy na Vercel. O mesmo projeto entrega:

- frontend Expo/React Native Web;
- API Next.js para autenticação, indicadores, manutenção, perfil e chatbot;
- reconhecimento de voz no navegador com `MediaRecorder`;
- transcrição externa de áudio com OpenAI;
- PostgreSQL para os dados da aplicação;
- upload opcional de avatar no Amazon S3.

## Privacidade do assistente

O texto das conversas e os dados do biodigestor são processados pelo motor local em TypeScript. Somente o arquivo de áudio gravado é enviado à API da OpenAI para transcrição.

## Requisitos

- Node.js 20 ou superior;
- PostgreSQL acessível pela Vercel;
- chave da API da OpenAI;
- conta GitHub e conta Vercel;
- bucket S3 opcional para fotos de perfil.

## Desenvolvimento local

```bash
npm install
npm run frontend:install
cp .env.example .env.local
```

Preencha `.env.local`, execute a migração em `db/migrations/001_initial_schema.sql` no PostgreSQL e então rode:

```bash
npm run build
npm run dev
```

A aplicação completa estará em `http://localhost:3003`. Para desenvolver o frontend com recarga rápida, use `npm run dev:frontend`; ele continuará chamando a API configurada em `EXPO_PUBLIC_API_URL` ou `/api` por padrão.

## Variáveis de ambiente

Obrigatórias:

- `POSTGRES_URL`: conexão PostgreSQL com SSL;
- `JWT_SECRET`: segredo aleatório longo para as sessões;
- `OPENAI_API_KEY`: chave usada somente no servidor;
- `OPENAI_TRANSCRIBE_MODEL`: opcional, padrão `gpt-4o-mini-transcribe`.

Opcionais:

- `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: fotos de perfil;
- `FRONTEND_URL`: origem externa adicional liberada pelo CORS;
- `STRIPE_SECRET_KEY`: pagamentos;

Nunca use uma variável `EXPO_PUBLIC_*` para segredos: essas variáveis são incorporadas ao JavaScript do navegador.

## Deploy na Vercel

1. Importe o repositório GitHub na Vercel.
2. Mantenha o diretório raiz como `.` e o framework como Next.js.
3. Cadastre as variáveis de ambiente de produção.
4. Execute `db/migrations/001_initial_schema.sql` no banco.
5. Faça o deploy. O script de build exporta o Expo Web para `public/` e compila a API Next.js.

O navegador exige HTTPS ou `localhost` para liberar o microfone. A URL pública da Vercel já usa HTTPS.

## Uso do microfone

- toque uma vez para iniciar e toque novamente para concluir;
- mantenha pressionado para gravar e solte para concluir;
- o navegador deve ter permissão de microfone;
- o áudio deve ter até 4 MB.

## Comandos

```bash
npm run dev             # aplicação unificada em localhost:3003
npm run dev:frontend    # servidor Expo Web de desenvolvimento
npm run typecheck       # valida o backend TypeScript
npm run build           # build completo igual ao da Vercel
```
