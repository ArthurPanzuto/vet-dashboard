const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const META_ACCESS_TOKEN = defineSecret("META_ACCESS_TOKEN");
const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

// Fase 1: um único número/organização. Configure via `functions/.env`
// (WHATSAPP_ORG_ID=<orgId da clínica>, WHATSAPP_PHONE_NUMBER_ID=<Phone Number ID da Meta>).
const ORG_ID = process.env.WHATSAPP_ORG_ID;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GRAPH_API_VERSION = "v20.0";

// Mesma lógica replicada no front-end (index.html) — mantenha as duas em sincronia.
function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function conversationsRef(orgId) {
  return db.collection("organizations").doc(orgId).collection("conversations");
}

// Busca best-effort: cruza o telefone normalizado contra tutorTelefone (texto
// livre) de todos os pacientes da org. Aceitável na escala de uma clínica só;
// reavaliar se o volume de pacientes crescer muito.
async function resolveTutorName(orgId, normalizedPhone) {
  const snap = await db.collection("organizations").doc(orgId).collection("patients").get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.tutorTelefone && normalizePhone(data.tutorTelefone) === normalizedPhone) {
      return data.tutorNome || null;
    }
  }
  return null;
}

async function handleIncomingMessage(message) {
  const normalizedPhone = normalizePhone(message.from);
  if (!normalizedPhone || !message.id) return;

  const text = message.text?.body ?? `[${message.type}]`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const windowExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  const convoRef = conversationsRef(ORG_ID).doc(normalizedPhone);
  const convoSnap = await convoRef.get();

  if (!convoSnap.exists) {
    const tutorNome = await resolveTutorName(ORG_ID, normalizedPhone);
    await convoRef.set({
      tutorTelefone: normalizedPhone,
      tutorNome,
      lastMessage: text,
      lastMessageAt: now,
      unreadCount: 1,
      windowExpiresAt,
    });
  } else {
    const patch = {
      lastMessage: text,
      lastMessageAt: now,
      unreadCount: admin.firestore.FieldValue.increment(1),
      windowExpiresAt,
    };
    if (!convoSnap.data().tutorNome) {
      patch.tutorNome = await resolveTutorName(ORG_ID, normalizedPhone);
    }
    await convoRef.update(patch);
  }

  await convoRef.collection("messages").doc(message.id).set({
    direction: "in",
    text,
    timestamp: now,
    status: "received",
    waMessageId: message.id,
  });
}

async function handleStatusUpdate(status) {
  const normalizedPhone = normalizePhone(status.recipient_id);
  if (!normalizedPhone || !status.id) return;
  await conversationsRef(ORG_ID)
    .doc(normalizedPhone)
    .collection("messages")
    .doc(status.id)
    .set({ status: status.status }, { merge: true });
}

// Endpoint público chamado pela Meta (handshake de verificação + eventos).
exports.whatsappWebhook = onRequest({ secrets: [META_VERIFY_TOKEN] }, async (req, res) => {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === META_VERIFY_TOKEN.value()) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
    return;
  }

  if (req.method !== "POST") {
    res.sendStatus(405);
    return;
  }

  try {
    if (!ORG_ID) throw new Error("WHATSAPP_ORG_ID não configurado.");
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const message of value.messages || []) {
          await handleIncomingMessage(message);
        }
        for (const status of value.statuses || []) {
          await handleStatusUpdate(status);
        }
      }
    }
  } catch (err) {
    logger.error("Erro processando webhook do WhatsApp", err);
  }

  // Sempre 200: a Meta reenvia o mesmo evento em caso de erro/timeout.
  res.sendStatus(200);
});

// Consultada pela aba "Mensagens" pra mostrar o status real da conexão —
// substitui o protótipo puramente visual (QR Code ilustrativo + localStorage)
// que existia antes. Não expõe nenhum segredo: só diz se as variáveis não
// secretas (WHATSAPP_ORG_ID/WHATSAPP_PHONE_NUMBER_ID) estão configuradas.
// Isso não garante que o access token seja válido — só confirma que o backend
// foi configurado; um token inválido só aparece no primeiro envio real.
exports.getWhatsappStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  return { configured: !!(ORG_ID && PHONE_NUMBER_ID) };
});

// Cria (ou reaproveita) uma conversa antes da primeira mensagem — usado pelo
// botão de WhatsApp na ficha do paciente, para a conversa já aparecer na lista.
exports.startConversation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  if (!ORG_ID) {
    throw new HttpsError("failed-precondition", "WhatsApp não configurado no backend.");
  }

  const conversationId = normalizePhone(request.data?.tutorTelefone);
  if (!conversationId) {
    throw new HttpsError("invalid-argument", "Telefone do tutor inválido.");
  }

  const convoRef = conversationsRef(ORG_ID).doc(conversationId);
  const snap = await convoRef.get();
  if (!snap.exists) {
    await convoRef.set({
      tutorTelefone: conversationId,
      tutorNome: request.data?.tutorNome || null,
      lastMessage: "",
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      unreadCount: 0,
      windowExpiresAt: null,
    });
  }

  return { conversationId };
});

// Callable usada pelo formulário de envio da aba "Mensagens".
exports.sendWhatsappMessage = onCall({ secrets: [META_ACCESS_TOKEN] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  if (!ORG_ID || !PHONE_NUMBER_ID) {
    throw new HttpsError("failed-precondition", "WhatsApp não configurado no backend.");
  }

  const conversationId = String(request.data?.conversationId || "");
  const text = String(request.data?.text || "").trim();
  if (!conversationId || !text) {
    throw new HttpsError("invalid-argument", "conversationId e text são obrigatórios.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conversationId,
        type: "text",
        text: { body: text },
      }),
    }
  );

  const result = await response.json();
  if (!response.ok) {
    const message = result?.error?.message || "Falha ao enviar mensagem pelo WhatsApp.";
    throw new HttpsError("aborted", message);
  }

  const waMessageId = result.messages?.[0]?.id || crypto.randomUUID();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const convoRef = conversationsRef(ORG_ID).doc(conversationId);

  await convoRef.set({ lastMessage: text, lastMessageAt: now }, { merge: true });
  await convoRef.collection("messages").doc(waMessageId).set({
    direction: "out",
    text,
    timestamp: now,
    status: "sent",
    waMessageId,
    sentBy: request.auth.uid,
  });

  return { ok: true, waMessageId };
});
