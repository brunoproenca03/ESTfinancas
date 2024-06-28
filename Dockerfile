# Usar a imagem oficial do Node.js como imagem base
FROM node:18

# Criar o diretório de trabalho do aplicativo
WORKDIR /app

# Copiar os arquivos do aplicativo para o contêiner
COPY package.json package-lock.json /app/
COPY server.js /app/
COPY public /app/public

# Instalar as dependências do aplicativo
RUN npm install

# Copiar o restante dos arquivos da aplicação
COPY . .

# Expor a porta em que o aplicativo será executado
EXPOSE 3000

# Comando para iniciar o aplicativo quando o contêiner for iniciado
CMD ["node", "server.js"]