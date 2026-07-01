FROM alpine:3.22

RUN apk add --no-cache ca-certificates curl tzdata util-linux
RUN addgroup -S zbs && adduser -S -G zbs zbs

WORKDIR /app

COPY zbs-dispatch-cron.sh /app/zbs-dispatch-cron.sh
COPY zbs-dispatch.cron /etc/crontabs/zbs

RUN chmod 0755 /app/zbs-dispatch-cron.sh \
  && chown zbs:zbs /app/zbs-dispatch-cron.sh /etc/crontabs/zbs \
  && rm -f /etc/crontabs/root

USER zbs

CMD ["crond", "-f", "-l", "8", "-L", "/dev/stdout"]
