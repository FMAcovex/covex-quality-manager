FROM postgres:16-bookworm
# PG16 client tools plus standard Python/OpenSSL; no credentials or config baked in.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca update && \
      apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca install -y --no-install-recommends python3 openssl ca-certificates; \
    else \
      apt-get update && apt-get install -y --no-install-recommends python3 openssl ca-certificates; \
    fi && rm -rf /var/lib/apt/lists/*
RUN install -d -m 0755 /opt/covex
COPY --chmod=0444 ops/backup/backup.py /opt/covex/backup.py
COPY --chmod=0444 ops/backup/storage.py /opt/covex/storage.py
COPY --chmod=0444 ops/backup/audit-contract.json /opt/covex/audit-contract.json
COPY --chmod=0444 ops/backup/audit-contract-b2.json /opt/covex/audit-contract-b2.json
COPY --chmod=0444 ops/backup/audit-contract-b2-capture.json /opt/covex/audit-contract-b2-capture.json
COPY --chmod=0444 ops/backup/audit-contract-b2-integration.json /opt/covex/audit-contract-b2-integration.json
COPY --chmod=0444 ops/backup/audit-contract-b2-documents.json /opt/covex/audit-contract-b2-documents.json
COPY --chmod=0444 ops/backup/audit-contract-b2-staging.json /opt/covex/audit-contract-b2-staging.json
USER 10001:10001
ENTRYPOINT ["python3", "/opt/covex/backup.py"]
