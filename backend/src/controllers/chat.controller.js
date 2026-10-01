import { generateStreamToken, upsertStreamUser } from "../lib/stream.js";

const cleanLanguageName = (language) => {
  if (typeof language !== "string") return "English";
  const cleaned = language.trim();
  if (!cleaned) return "English";
  return cleaned;
};

const buildTranslationPrompt = (text, targetLanguage) =>
  [
    "You are a translation service.",
    "Translate the text into the requested target language only.",
    "Do not explain the translation or add commentary.",
    "Return only the translated text exactly as it should appear to the user.",
    `Target language: ${cleanLanguageName(targetLanguage)}`,
    `Text to translate:\n${text}`,
  ].join("\n");

const translateWithOpenAI = async (text, targetLanguage) => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) {
    return null;
  }

  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/$/, "");

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You translate user text faithfully and preserve meaning without adding extra commentary.",
        },
        {
          role: "user",
          content: buildTranslationPrompt(text, targetLanguage),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      errorText || "The translation service could not complete the request.",
    );
  }

  const payload = await response.json();
  const translatedText =
    payload?.choices?.[0]?.message?.content?.trim() ||
    payload?.choices?.[0]?.text?.trim();

  if (!translatedText) {
    throw new Error("The translation service returned no translated text.");
  }

  return translatedText;
};

export async function getStreamToken(req, res) {
  try {
    const token = generateStreamToken(req.user.id);

    res.status(200).json({ token });
  } catch (error) {
    console.log("error in getStreamToken controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function syncStreamUsers(req, res) {
  try {
    const users = Array.isArray(req.body?.users) ? req.body.users : [];

    if (!users.length) {
      return res.status(400).json({ message: "At least one user is required" });
    }

    const syncedUsers = await Promise.all(
      users.map(async (user) => {
        if (!user?.id) return null;

        const payload = {
          id: String(user.id),
          name: user.name || String(user.id),
          image: user.image || "",
        };

        await upsertStreamUser(payload);
        return payload.id;
      }),
    );

    return res.status(200).json({
      success: true,
      syncedUsers: syncedUsers.filter(Boolean),
    });
  } catch (error) {
    console.log("error in syncStreamUsers controller", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function translateChatMessage(req, res) {
  try {
    const messageId =
      typeof req.params?.messageId === "string" ? req.params.messageId : "";
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const targetLanguage = cleanLanguageName(req.body?.targetLanguage);

    if (!messageId) {
      return res.status(400).json({ message: "Message id is required." });
    }

    if (!text) {
      return res.status(400).json({ message: "Message text is required." });
    }

    const translatedText = await translateWithOpenAI(text, targetLanguage);

    if (!translatedText) {
      return res.status(503).json({
        message:
          "Translation is not configured on this server yet. Please try again later or set a language preference in the app.",
      });
    }

    return res.status(200).json({
      success: true,
      messageId,
      text,
      targetLanguage,
      translation: translatedText,
    });
  } catch (error) {
    console.error("Error translating message", error.message);
    return res.status(502).json({
      message: "Translation failed. Please try again in a moment.",
    });
  }
}
