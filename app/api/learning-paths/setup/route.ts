import { NextResponse } from "next/server";
import {
  parseLearningPathSetupGuidance,
  type LearningPathSetupStep,
} from "@/lib/learning-path-setup";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const VALID_STEPS = new Set<LearningPathSetupStep>([
  "topic",
  "goal",
  "experience",
  "schedule",
  "materials",
]);

type SetupRequest = {
  step?: unknown;
  answers?: unknown;
};

type OllamaResponse = {
  message?: { content?: string };
  error?: string;
};

function ollamaChatUrl() {
  const baseUrl = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434/api").replace(/\/+$/, "");
  return baseUrl.endsWith("/api") ? `${baseUrl}/chat` : `${baseUrl}/api/chat`;
}

function safeAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    ["topic", "goal", "startingLevel", "schedule", "materialNotes"].flatMap((key) => {
      const field = record[key];
      if (typeof field !== "string") return [];
      return [[key, field.trim().slice(0, key === "materialNotes" ? 4000 : 1000)]];
    }),
  );
}

function stepContract(step: LearningPathSetupStep) {
  if (step === "topic") {
    return [
      "Ask a topic-neutral question that does not name or imply a subject.",
      "Return 4 concise suggestions spanning materially different subjects or learning intents.",
      "Saved context and recent paths are optional history, not the learner's current request.",
      "At most one suggestion may continue a saved focus or recent path; the other three must not be variants of that subject, framework, or domain.",
      "Each option needs a user-facing label and a clean subject or exam name as its value.",
    ].join(" ");
  }
  if (step === "goal") {
    return "Return 3 or 4 concrete outcomes tailored to the topic and learner. Include at least one modest, achievable first outcome. Do not add technologies, credentials, or requirements the learner did not mention. Each value must be a complete goal suitable for saving.";
  }
  if (step === "experience") {
    return "Return exactly 4 options with values beginner, intermediate, advanced, and unsure. Personalize only their labels so each is easy to self-assess.";
  }
  if (step === "schedule") {
    return "Return exactly 4 options with values few-days, two-weeks, month, and open. Labels may reflect the learner's goal but must preserve those time meanings.";
  }
  return "Return no options. Ask whether they have PDFs, notes, a syllabus, or other source material relevant to this specific goal.";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  let body: SetupRequest;
  try {
    body = (await request.json()) as SetupRequest;
  } catch {
    return NextResponse.json({ error: "Invalid setup request" }, { status: 400 });
  }
  if (typeof body.step !== "string" || !VALID_STEPS.has(body.step as LearningPathSetupStep)) {
    return NextResponse.json({ error: "Invalid setup step" }, { status: 400 });
  }
  const step = body.step as LearningPathSetupStep;
  const answers = safeAnswers(body.answers);

  const [profileResult, itemsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("learning_focus, learning_context, goals, daily_study_time")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("learning_items")
      .select("title")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(5),
  ]);

  const prompt = [
    "You are EduSynapse's learning-path planner. Ask one short setup question and propose only choices that materially change the path.",
    "Use the learner's current answers as intent. Saved context and recent paths may personalize an option, but must never be treated as the learner's current request.",
    "Do not claim to know facts that are not provided. Do not repeat a question already answered.",
    "Keep the interaction practical, specific, and suitable for a 60–90 second setup. Return JSON only with shape { question: string, options: [{ label: string, value: string }] }.",
    `Current step: ${step}`,
    stepContract(step),
    "CURRENT_ANSWERS",
    JSON.stringify(answers),
    "SAVED_LEARNER_CONTEXT",
    JSON.stringify(profileResult.data ?? {}),
    "OPTIONAL_HISTORY_NOT_CURRENT_INTENT",
    JSON.stringify((itemsResult.data ?? []).map((item) => item.title)),
  ].join("\n\n");

  try {
    const response = await fetch(ollamaChatUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model:
          process.env.LEARNING_PATH_SETUP_MODEL ??
          process.env.LEARNING_PATH_MODEL ??
          "gpt-oss:120b-cloud",
        stream: false,
        format: "json",
        options: { temperature: 0.35 },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const payload = (await response.json()) as OllamaResponse;
    if (!response.ok || payload.error || !payload.message?.content) {
      throw new Error("Setup model did not return guidance");
    }
    return NextResponse.json(
      parseLearningPathSetupGuidance(payload.message.content, step),
    );
  } catch {
    return NextResponse.json(
      { error: "Personalized setup is temporarily unavailable" },
      { status: 503 },
    );
  }
}
