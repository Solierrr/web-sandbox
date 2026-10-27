FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://github.com/Infisical/cli/releases/download/v0.44.9/cli_0.44.9_linux_amd64.tar.gz -o /tmp/infisical.tar.gz \
    && echo "4005a430258df60401ae5288ab0412371f2e56f224ed461758dd2ec83887d556  /tmp/infisical.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/infisical.tar.gz -C /usr/local/bin infisical \
    && rm /tmp/infisical.tar.gz && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=5180
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/.server-dist ./.server-dist
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh
USER node
EXPOSE 5180
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", ".server-dist/server/index.js"]
