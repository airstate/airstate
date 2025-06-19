FROM nats:2.11.1-alpine3.21

RUN mkdir -p /data && chown -R nats:nats /data

COPY nats-server.conf /etc/nats/nats-server.conf

RUN chown nats:nats /etc/nats/nats-server.conf

USER nats

EXPOSE 4222 8222

WORKDIR /data

CMD ["-c", "/etc/nats/nats-server.conf", "--server_name", "nats"]