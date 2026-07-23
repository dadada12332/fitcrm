FROM node:20-alpine

WORKDIR /opt/fitcrm-bridge
COPY package.json ./
COPY bin ./bin
COPY src ./src

RUN addgroup -S bridge && adduser -S bridge -G bridge \
  && mkdir -p /var/lib/fitcrm-bridge \
  && chown -R bridge:bridge /opt/fitcrm-bridge /var/lib/fitcrm-bridge

USER bridge
ENV FITCRM_BRIDGE_CONFIG=/etc/fitcrm-bridge/config.json
VOLUME ["/etc/fitcrm-bridge", "/var/lib/fitcrm-bridge"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8787/health || exit 1

CMD ["node", "./bin/fitcrm-bridge.mjs", "start"]
