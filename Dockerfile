# Image minuscule : Node pur, aucune dépendance npm
FROM node:20-alpine
WORKDIR /app
COPY server.js ./
COPY public/ ./public/
# Le dossier data/ est monté en volume (état du suivi persistant)
EXPOSE 80
CMD ["node", "server.js"]
