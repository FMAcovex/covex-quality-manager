FROM postgres:16-bookworm
# PG16 client tools plus standard Python/OpenSSL; no credentials or config baked in.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then \
      apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca update && \
      apt-get -o Acquire::https::CaInfo=/run/secrets/proxy_ca install -y --no-install-recommends python3 openssl ca-certificates; \
    else \
      apt-get update && apt-get install -y --no-install-recommends python3 openssl ca-certificates; \
    fi && rm -rf /var/lib/apt/lists/*
COPY --chmod=0444 ops/backup/backup.py /opt/covex/backup.py
USER 10001:10001
ENTRYPOINT ["python3", "/opt/covex/backup.py"]
