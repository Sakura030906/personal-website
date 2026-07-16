FROM postgres:16-alpine

RUN apk add --no-cache python3 py3-pip \
    && python3 -m venv /opt/backup-venv \
    && /opt/backup-venv/bin/pip install --no-cache-dir alibabacloud-oss-v2==1.3.2

WORKDIR /backup-app
COPY ops/backup/*.py ./

ENV PATH="/opt/backup-venv/bin:$PATH"
CMD ["python", "backup_loop.py"]
