# SteamRecommender

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Elysia, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Elysia** - Type-safe, high-performance framework
- **Bun** - Runtime environment
- **Mongoose** - TypeScript-first ORM
- **MongoDB** - Database engine
- **Authentication** - Better-Auth
- **Biome** - Linting and formatting
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```
## Database Setup

This project uses MongoDB with Mongoose.

1. Make sure you have MongoDB set up.
2. Update your `apps/server/.env` file with your MongoDB connection URI.

3. Apply the schema to your database:
```bash
bun db:push
```


Then, run the development server:

```bash
bun dev
```

The API is running at [http://localhost:3000](http://localhost:3000).

## Vector Search Recommendations

1. **Configura las variables de entorno** en `apps/server/.env`:
	```env
	EMBEDDING_PROVIDER="openai" # o "gemini"
	OPENAI_API_KEY="tu-api-key"
	GEMINI_API_KEY="tu-api-key-de-gemini"
	OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
	OPENAI_EMBEDDING_DIMENSIONS="1536"
	GEMINI_EMBEDDING_MODEL="text-embedding-004"
	GEMINI_EMBEDDING_DIMENSIONS="768"
	MONGODB_VECTOR_INDEX="game_embedding_index"
	RECOMMENDER_MIN_RATING="3"
	```
	Cambia `EMBEDDING_PROVIDER` a `gemini` si prefieres la API de Google y ajusta el modelo/dimensiones según tu cuenta.
2. **Instala dependencias** (incluye el cliente oficial de OpenAI):
	```bash
	bun install
	```
3. **Valida o crea el índice vectorial**: al iniciar el servidor (`bun dev`) se verifica/crea el índice definido en Atlas (`game_embedding_index`).
4. **Genera embeddings para los juegos existentes**:
	```bash
	bun workspace @SteamRecommender/db run backfill:embeddings
	```
	El script rellena únicamente los juegos sin vector y hace pequeñas pausas para respetar los límites de la API.
5. **Endpoint de recomendaciones**: `GET /api/games/recommendations` ahora usa embeddings automáticamente (con fallback colaborativo). También puedes llamar explícitamente a `GET /api/games/vector-recommendations`, que acepta alguno de los parámetros:
	- `userId` o `email`: promedia los embeddings de juegos calificados por el usuario.
	- `appid` o `gameId`: busca juegos parecidos al especificado.
	- `text`: genera recomendaciones a partir de una descripción libre.

## Project Structure

```
SteamRecommender/
├── apps/
│   └── server/      # Backend API (Elysia)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun dev`: Start all applications in development mode
- `bun build`: Build all applications
- `bun dev:web`: Start only the web application
- `bun dev:server`: Start only the server
- `bun check-types`: Check TypeScript types across all apps
- `bun db:push`: Push schema changes to database
- `bun db:studio`: Open database studio UI
- `bun check`: Run Biome formatting and linting


### Divisoón de tareas

Base de Datos

|tarea|quien|
|:---:|:---:|
|Crear Esquema bd|quien|
|Poblar BD|quien|
|Recomendador |quien|

Backend Endpoints

|tarea|quien|
|:---:|:---:|
|Juegos Top|quien|
|Juegos * Usuario|quien|
|Recomendados * Usuario|quien|

Backend Endpoints

|tarea|quien|
|:---:|:---:|
|Login|quien|
|Interfaz Principal|quien|
|Usuario|quien|