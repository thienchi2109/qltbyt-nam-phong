# ZBS VM Dispatch Scheduler

Use this scheduler when Vercel Cron cannot run a sub-daily ZBS dispatch cadence.
The VM only calls the guarded production endpoint; it does not need application
source code or database credentials.

## Deploy

```bash
sudo mkdir -p /opt/qltbyt/zbs-dispatch-scheduler
sudo cp -a ops/zbs-dispatch-scheduler/. /opt/qltbyt/zbs-dispatch-scheduler/
cd /opt/qltbyt/zbs-dispatch-scheduler
sudo cp .env.example .env
sudo chmod 600 .env
sudo editor .env
sudo docker compose up -d --build
```

Set `.env` on the VM:

```env
ZBS_DISPATCH_URL=https://www.cvmems.vn/api/cron/zbs-dispatch
CRON_SECRET=<same value as Vercel Production CRON_SECRET>
```

Do not commit `.env` or print `CRON_SECRET` in logs.

## Verify

Run one manual scheduler invocation from the VM:

```bash
cd /opt/qltbyt/zbs-dispatch-scheduler
sudo docker compose run --rm zbs-dispatch /app/zbs-dispatch-cron.sh
sudo docker compose logs --tail=100
```

Expected result: the script logs `zbs_dispatch ok` with the endpoint JSON
response. A `401` means the VM `.env` secret does not match the Vercel
Production `CRON_SECRET`.

## Operate

```bash
cd /opt/qltbyt/zbs-dispatch-scheduler
sudo docker compose ps
sudo docker compose logs -f
sudo docker compose restart
sudo docker compose down
```

The container uses `flock` so a slow dispatch run cannot overlap the next
five-minute tick.
