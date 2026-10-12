FROM postgres:16-bookworm
# PG16 client tools plus standard Python/OpenSSL; no credentials or config baked in.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then cp /run/secrets/proxy_ca /usr/local/share/ca-certificates/build-proxy.crt; update-ca-certificates; fi; \
    apt-get update && apt-get install -y --no-install-recommends python3 openssl && \
    rm -rf /var/lib/apt/lists/* /usr/local/share/ca-certificates/build-proxy.crt && update-ca-certificates --fresh
COPY ops/backup/backup.py /opt/covex/backup.py
USER 10001:10001
ENTRYPOINT ["python3", "/opt/covex/backup.py"]
