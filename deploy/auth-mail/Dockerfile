FROM node:24-alpine
WORKDIR /relay
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY relay.mjs server.mjs ./
USER node
EXPOSE 8091
CMD ["node", "server.mjs"]
