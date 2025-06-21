FROM node:22.16.0-alpine3.22 AS common

WORKDIR /app

FROM common AS build

RUN apk add --no-cache build-base linux-headers python3

COPY . .

ENV ILA_FIELDS=country

RUN corepack enable
RUN corepack install
RUN pnpm install
RUN pnpm run build





FROM common AS production

COPY --from=build /app .

CMD ["node", "."]
