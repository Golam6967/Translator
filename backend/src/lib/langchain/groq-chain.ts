import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers"; // 1. Added the string parser import

const groqApiKey = process.env.GROQ_API_KEY;
console.log("Groq API Key status:", groqApiKey ? "Found" : "Missing");

if (!groqApiKey) {
  throw new Error("GROQ_API_KEY environment variable is not set");
}

const llm = new ChatGroq({
  apiKey: groqApiKey,
  model: "llama-3.3-70b-versatile",
  temperature: 0.3,
});

// Translation prompt template
const translationPrompt = PromptTemplate.fromTemplate(
  `You are an expert translator specializing in Islamic texts and literature.

Translate the following text from {sourceLang} to {targetLang}.
Maintain the meaning, tone, and context of the original text.
If there are religious or cultural terms, provide accurate translations that preserve their meaning.

Text to translate:
{text}

Provide only the translation, without any additional explanation or commentary.`,
);

// Create translation chain
export const createTranslationChain = () => {
  // 2. Appended StringOutputParser to pipe the AI message directly into a string
  return RunnableSequence.from([
    translationPrompt,
    llm,
    new StringOutputParser(),
  ]);
};

// Function to translate text to multiple languages
export async function translateText(
  text: string,
  targetLanguages: string[],
): Promise<Record<string, string>> {
  const chain = createTranslationChain();
  const translations: Record<string, string> = {};

  // Language code to full name mapping
  const languageNames: Record<string, string> = {
    bn: "Bengali",
    ar: "Arabic",
    fa: "Persian",
    ur: "Urdu",
    en: "English",
    tr: "Turkish",
  };

  for (const langCode of targetLanguages) {
    try {
      const langName = languageNames[langCode] || langCode;

      // 3. This invocation now directly yields a clean string string
      const response = await chain.invoke({
        sourceLang: "Bengali",
        targetLang: langName,
        text,
      });

      translations[langCode] = response.trim();
    } catch (error) {
      console.error(`Translation to ${langCode} failed:`, error);
      translations[langCode] = "";
    }
  }

  return translations;
}
