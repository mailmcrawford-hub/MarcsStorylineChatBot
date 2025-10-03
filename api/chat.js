// /api/chat.js
export const config = { runtime: "edge" };

import { NextResponse } from "next/server";
import { system, schema, fewShot } from "./betty";
import { detectToneFromText, responseBank } from "./bettybank";

function cors(json, status = 200) {
  return new NextResponse(JSON.stringify(json), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization"
    }
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return cors({ ok: true });

  try {
    const body = await req.json();
    const {
      detective_utterance = "",
      history_summary = "",
      detective_tone // optional; if not provided we infer
    } = body || {};

    const tone = detective_tone || detectToneFromText(detective_utterance);

    // Compose messages
    const messages = [];
    messages.push({ role: "system", content: system });

    // few-shot examples
    (fewShot || []).forEach(ex => {
      messages.push({
        role: "user",
        content: `Tone: ${ex.detective_tone}\nHistory: ${ex.history_summary}\nDetective: ${ex.detective_utterance}`
      });
      messages.push({ role: "assistant", content: JSON.stringify(ex.response) });
    });

    // live turn
    messages.push({
      role: "user",
      content: `Tone: ${tone}\nHistory: ${history_summary}\nDetective: ${detective_utterance}`
    });

    // Call OpenAI Responses API
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages,
        response_format: {
          type: "json_schema",
          json_schema: { name: "FredaSchema", schema, strict: true }
        },
        max_output_tokens: 450
      })
    });

    if (!r.ok) {
      const txt = await r.text();
      return cors({ error: `OpenAI error ${r.status}: ${txt}` }, 500);
    }

    const data = await r.json();

    // Extract JSON payload from Responses API
    let payload = null;
    try {
      // responses API: data.output is an array of content blocks
      const blocks = data.output ?? [];
      const textBlock = Array.isArray(blocks)
        ? blocks.find(b => b.type === "output_text")?.text
        : null;
      payload = textBlock ? JSON.parse(textBlock) : null;
    } catch {
      payload = null;
    }

    // Fallback to a minimal valid object if parsing failed
    if (!payload || !payload.reply_text) {
      const fallbackText =
        (responseBank.cooperative && responseBank.cooperative[0]) ||
        "I can walk you through it. It arrived by courier the week before our renewal meeting.";
      payload = {
        reply_text: fallbackText,
        tone_detected: tone,
        stance: "cooperative",
        policy_points_referenced: [],
        risk_flags: [],
        next_questions_for_detective: ["Do you need the exact delivery date"],
        memory_updates: {
          facts_confirmed: [],
          facts_corrected: [],
          stage_hint: "discovery"
        },
        suggested_stage_transition: "stay"
      };
    }

    return cors(payload, 200);
  } catch (e) {
    return cors({ error: e?.message || "Unknown server error" }, 500);
  }
}
