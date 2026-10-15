FROM node:24-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
COPY config ./config
COPY scripts ./scripts
RUN mkdir -p /app/data && chown node:node /app/data
USER node
ENV CONTEXT_MODE=authenticated HOST=0.0.0.0 PORT=8788 CONTEXT_DB=/app/data/context.sqlite
EXPOSE 8788
VOLUME ["/app/data"]
CMD ["node", "src/server.js"]
