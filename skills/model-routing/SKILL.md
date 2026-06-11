---
name: model-routing
description: Select and route tasks to the best model by cost, latency, quality, and modality. Use when configuring primary and fallback models for chat, coding, or image generation.
---

- Set one primary model per task type.
- Add one fallback model with known auth.
- Detect the project language and provider before selecting SDK-specific guidance.
- Route high-risk tasks to high-reliability models.
- Route bulk or draft tasks to low-cost models.
- Keep provider-specific API details out of default context; load them only for an active integration.
- Treat provider documentation as implementation evidence, not universal routing doctrine.
- Log model choice and reason.
