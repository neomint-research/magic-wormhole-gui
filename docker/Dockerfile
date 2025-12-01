FROM python:3.12-slim

RUN pip install --no-cache-dir magic-wormhole

RUN useradd -m -s /bin/bash wormhole
USER wormhole

WORKDIR /data

ENTRYPOINT []
CMD ["wormhole", "--version"]
