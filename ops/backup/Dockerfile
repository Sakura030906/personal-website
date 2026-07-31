FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir alibabacloud-oss-v2==1.3.2 \
    && groupadd --gid 10002 backupsvc \
    && useradd --uid 10002 --gid backupsvc --no-create-home --shell /usr/sbin/nologin backupsvc \
    && mkdir -p /backups \
    && chown backupsvc:backupsvc /backups

WORKDIR /backup-app
COPY --chown=backupsvc:backupsvc ops/backup/*.py ./

USER backupsvc

CMD ["python", "backup_loop.py"]
