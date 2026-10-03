# Hugging Face Space (Docker SDK). Builds the app straight from GitHub.
# Set GROQ_API_KEY under Settings → Variables and secrets. Rebuild the Space to pull new commits.
FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone --depth 1 https://github.com/Aymen016/quorum.git .

WORKDIR /app/web
RUN npm ci --include=dev && npm run build

# Spaces run the container as uid 1000 (the "node" user in this image); it needs to write data/.
RUN mkdir -p data && chown -R node:node /app
USER node

ENV PORT=7860 NODE_ENV=production
EXPOSE 7860
CMD ["npm", "start"]
