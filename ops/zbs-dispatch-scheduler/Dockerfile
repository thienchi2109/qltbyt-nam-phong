FROM alpine:3.22

RUN apk add --no-cache ca-certificates curl tzdata util-linux

WORKDIR /app

COPY zbs-dispatch-cron.sh /app/zbs-dispatch-cron.sh
COPY zbs-dispatch.cron /etc/crontabs/root

RUN chmod 0755 /app/zbs-dispatch-cron.sh

CMD ["crond", "-f", "-l", "8", "-L", "/dev/stdout"]
