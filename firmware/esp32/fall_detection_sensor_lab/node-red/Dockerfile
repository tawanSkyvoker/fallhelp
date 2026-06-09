FROM nodered/node-red:latest

# Install @flowfuse/node-red-dashboard into the image layer (NOT in userDir volume).
# This ensures Dashboard 2.0 is always available regardless of volume state.
WORKDIR /usr/src/node-red
RUN npm install @flowfuse/node-red-dashboard

# Bake the source flow into the image so the entrypoint can initialise
# /data/flows.json on first start without needing a bind-mount of the source tree.
COPY firmware/esp32/fall_detection_sensor_lab/node-red/flows/fall-detection-sensor-lab-flow.v2.json \
     /source/flows.json

# Keep baked flow and default userDir writable by the node-red runtime user.
USER root
RUN chown -R node-red:node-red /source /data
USER node-red

# Entrypoint script — handles first-start init and /data/runs creation.
COPY --chmod=755 firmware/esp32/fall_detection_sensor_lab/node-red/docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
