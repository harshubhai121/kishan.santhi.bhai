export default {
  async fetch(request, env) {
    const allowedOrigin = "https://YOUR-GITHUB-USERNAME.github.io";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return json({ error: "POST request required" }, 405, allowedOrigin);
    }

    const url = new URL(request.url);

    if (url.pathname !== "/analyze") {
      return json({ error: "Not found" }, 404, allowedOrigin);
    }

    if (!env.OPENAI_API_KEY) {
      return json({ error: "AI service is not configured" }, 500, allowedOrigin);
    }

    try {
      const body = await request.json();

      const crop = String(body.crop || "").trim();
      const image = String(body.image || "");

      if (!crop || !image) {
        return json(
          { error: "Crop and image are required" },
          400,
          allowedOrigin
        );
      }

      // Basic size protection
      if (image.length > 7_000_000) {
        return json(
          { error: "Image is too large" },
          413,
          allowedOrigin
        );
      }

      if (!/^data:image\/(jpeg|png|webp);base64,/i.test(image)) {
        return json(
          { error: "Only JPG, PNG and WebP images are supported" },
          400,
          allowedOrigin
        );
      }

      const response = await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text:
                      `You are a careful agricultural assistant. ` +
                      `The farmer says the crop is ${crop}. ` +
                      `Analyze the uploaded crop image. ` +
                      `Do not claim certainty from an image alone. ` +
                      `Give a concise report in Hindi with: ` +
                      `1) possible issue, 2) visible signs, ` +
                      `3) general care steps, 4) when to contact a local agricultural expert.`
                  },
                  {
                    type: "input_image",
                    image_url: image
                  }
                ]
              }
            ],
            max_output_tokens: 500
          })
        }
      );

      if (!response.ok) {
        return json(
          { error: "AI service temporarily unavailable" },
          502,
          allowedOrigin
        );
      }

      const data = await response.json();

      return json(
        {
          success: true,
          result: data.output_text || "Analysis result unavailable."
        },
        200,
        allowedOrigin
      );

    } catch (error) {
      return json(
        { error: "Invalid request or server error" },
        400,
        allowedOrigin
      );
    }
  }
};

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Cache-Control": "no-store"
    }
  });
}
