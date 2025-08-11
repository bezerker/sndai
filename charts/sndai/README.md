This chart deploys `sndai` (WoW gear assistant) with optional Discord bot, Secrets for sensitive env vars, optional Service and Ingress for HTTP exposure, and optional PVC for persisting the memory database.

Quickstart:

```sh
# Render defaults
helm template sndai ./charts/sndai

# Install with secrets and discord disabled
helm upgrade -i sndai ./charts/sndai \
  --set image.repository=ghcr.io/YOUR_USER/sndai \
  --set image.tag=latest \
  --set secrets.OPENAI_API_KEY=sk-... \
  --set secrets.BLIZZARD_CLIENT_ID=... \
  --set secrets.BLIZZARD_CLIENT_SECRET=... \
  --set secrets.BRAVE_API_KEY=... \
  --set env.DISCORD_ENABLED="false"

# If you want ingress (requires service)
helm upgrade -i sndai ./charts/sndai \
  --set service.enabled=true \
  --set service.port=8080 \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=sndai.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix

# To persist memory.db
helm upgrade -i sndai ./charts/sndai \
  --set persistence.enabled=true \
  --set persistence.size=1Gi
```

Notes:
- Secrets are created from `values.yaml` keys under `secrets`. Leave them empty to skip, or pass via `--set` or a separate values file.
- If you only run the Discord bot, you may not need a Service/Ingress. If you expose an HTTP endpoint later, enable Service and Ingress.
- For NGINX ingress, set `ingress.className=nginx` (or rely on annotation `kubernetes.io/ingress.class: nginx`).
- The container starts a Discord worker when `DISCORD_ENABLED="true"`. Ensure `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` are provided.
