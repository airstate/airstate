FROM nats:2.11.1-alpine3.21

RUN mkdir -p /data 

COPY nats-server.conf /etc/nats/nats-server.conf

EXPOSE 4222 8222

WORKDIR /data

CMD ["-c", "/etc/nats/nats-server.conf", "--server_name", "nats"]