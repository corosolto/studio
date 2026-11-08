// The `openai/gpt-image-*` family is only served by OpenRouter's dedicated Images API
// (/api/v1/images); through chat/completions those models finish with an error and no image.
export const usesOpenRouterImagesApi = model => /^openai\/gpt-image-/.test(model);
