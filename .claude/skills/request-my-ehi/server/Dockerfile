FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile 2>/dev/null || bun install

COPY src/ src/
COPY public/ public/

ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
