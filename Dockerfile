FROM node:22.12.0-bookworm

RUN apt-get update && apt-get install -y build-essential

RUN npm install -g pnpm@10.6.4
RUN wget -qO - https://github.com/omranjamal/mono-cd/releases/download/v1.4.0/docker-install.sh | sh -

