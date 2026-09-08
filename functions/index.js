const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// META_APP_SECRET é usado só na troca do código do Embedded Signup por um
// token de acesso — nunca chega ao cliente. META_ACCESS_TOKEN (fase 1,
// single-tenant) não é mais usado: cada clínica agora tem o próprio token,
// gravado em organizations/{orgId}/integrations/whatsapp por connectWhatsapp.
const META_APP_SECRET = defineSecret("META_APP_SECRET");
const META_VERIFY_TOKEN = defineSecret("META_VERIFY_TOKEN");

// App ID não é segredo (é público, igual ao Client ID do Google ou à
// config do Firebase) — só identifica qual App da Meta estamos usando pra
// trocar o código do Embedded Signup por um token. Preencha via
// `functions/.env` (META_APP_ID=...) depois de criar o App em
// developers.facebook.com e habilitar o Embedded Signup nele.
const META_APP_ID = process.env.META_APP_ID || "";
const GRAPH_API_VERSION = "v20.0";

// Mesma lógica replicada no front-end (index-beta.html) — mantenha as duas em sincronia.
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

// Documento único por clínica com a conexão de WhatsApp dela (token
// incluído). Nunca lido/escrito pelo cliente — só pelo Admin SDK aqui
// (ver firestore.rules: organizations/{orgId}/integrations/{docId} nega
// tudo pro cliente).
function integrationRef(orgId) {
  return db.collection("organizations").doc(orgId).collection("integrations").doc("whatsapp");
}

// Coleção de nível raiz (fora de organizations/{orgId}) que mapeia o
// Phone Number ID da Meta pra qual clínica ele pertence — é o que permite
// ao webhook (que recebe mensagens sem saber de qual clínica são) achar a
// organização certa. Só Admin SDK.
function routingRef(phoneNumberId) {
  return db.collection("whatsappPhoneRouting").doc(phoneNumberId);
}

async function getOrgIdForUid(uid) {
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists ? snap.data().orgId || null : null;
}

async function resolveOrgIdForPhoneNumber(phoneNumberId) {
  if (!phoneNumberId) return null;
  const snap = await routingRef(phoneNumberId).get();
  return snap.exists ? snap.data().orgId : null;
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

async function handleIncomingMessage(orgId, message) {
  const normalizedPhone = normalizePhone(message.from);
  if (!normalizedPhone || !message.id) return;

  const text = message.text?.body ?? `[${message.type}]`;
  const now = admin.firestore.FieldValue.serverTimestamp();
  const windowExpiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  const convoRef = conversationsRef(orgId).doc(normalizedPhone);
  const convoSnap = await convoRef.get();

  if (!convoSnap.exists) {
    const tutorNome = await resolveTutorName(orgId, normalizedPhone);
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
      patch.tutorNome = await resolveTutorName(orgId, normalizedPhone);
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

async function handleStatusUpdate(orgId, status) {
  const normalizedPhone = normalizePhone(status.recipient_id);
  if (!normalizedPhone || !status.id) return;
  await conversationsRef(orgId)
    .doc(normalizedPhone)
    .collection("messages")
    .doc(status.id)
    .set({ status: status.status }, { merge: true });
}

// Endpoint público chamado pela Meta (handshake de verificação + eventos).
// Um único webhook pro App inteiro — a Meta não sabe de "clínicas", só
// manda o phone_number_id de quem recebeu a mensagem; é esta função quem
// resolve, via whatsappPhoneRouting, pra qual organização aquilo pertence.
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
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        const orgId = await resolveOrgIdForPhoneNumber(phoneNumberId);
        if (!orgId) {
          logger.warn("Webhook recebido para um phone_number_id sem clínica conectada — ignorado.", { phoneNumberId });
          continue;
        }
        for (const message of value.messages || []) {
          await handleIncomingMessage(orgId, message);
        }
        for (const status of value.statuses || []) {
          await handleStatusUpdate(orgId, status);
        }
      }
    }
  } catch (err) {
    logger.error("Erro processando webhook do WhatsApp", err);
  }

  // Sempre 200: a Meta reenvia o mesmo evento em caso de erro/timeout.
  res.sendStatus(200);
});

// Consultada pela aba "Integrações" pra mostrar o status real da conexão
// da clínica de quem está logado. Não expõe nenhum segredo: só diz se
// existe uma conexão salva e, se sim, o telefone/nome pra exibir na tela.
exports.getWhatsappStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  const orgId = await getOrgIdForUid(request.auth.uid);
  if (!orgId) return { configured: false };

  const snap = await integrationRef(orgId).get();
  if (!snap.exists) return { configured: false };

  const data = snap.data();
  return {
    configured: true,
    phoneNumber: data.displayPhoneNumber || null,
    businessName: data.businessName || null,
  };
});

// Chamada pelo botão "Conectar WhatsApp" depois que o popup do Embedded
// Signup da Meta termina no navegador do cliente. Troca o código de
// autorização por um token de acesso da WABA que ele acabou de conectar,
// assina o app pros webhooks daquela WABA, e grava tudo escopado à
// organização de quem chamou (nunca confia num orgId vindo do cliente).
//
// Atenção: os nomes exatos dos parâmetros/endpoints da Graph API abaixo
// seguem a documentação de Embedded Signup da Meta na época em que isso
// foi escrito — confira contra developers.facebook.com/docs/whatsapp/embedded-signup
// antes do primeiro teste real, já que a Meta versiona e ajusta esse fluxo.
exports.connectWhatsapp = onCall({ secrets: [META_APP_SECRET] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  const orgId = await getOrgIdForUid(request.auth.uid);
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Usuário sem organização associada.");
  }
  if (!META_APP_ID) {
    throw new HttpsError("failed-precondition", "META_APP_ID não configurado no backend.");
  }

  const code = String(request.data?.code || "");
  const wabaId = String(request.data?.wabaId || "");
  const phoneNumberId = String(request.data?.phoneNumberId || "");
  if (!code || !wabaId || !phoneNumberId) {
    throw new HttpsError("invalid-argument", "code, wabaId e phoneNumberId são obrigatórios.");
  }

  const tokenUrl =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token` +
    `?client_id=${encodeURIComponent(META_APP_ID)}` +
    `&client_secret=${encodeURIComponent(META_APP_SECRET.value())}` +
    `&code=${encodeURIComponent(code)}`;
  const tokenResponse = await fetch(tokenUrl);
  const tokenResult = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenResult.access_token) {
    logger.error("Falha ao trocar código do Embedded Signup por token de acesso.", tokenResult);
    throw new HttpsError("aborted", tokenResult?.error?.message || "Falha ao concluir a conexão com a Meta.");
  }
  const accessToken = tokenResult.access_token;

  // Assina o app pra receber webhooks dessa WABA especificamente — cada
  // clínica precisa disso individualmente, não é automático.
  await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Busca nome/telefone só pra exibir na tela — nunca o token em si.
  let businessName = null;
  let displayPhoneNumber = null;
  try {
    const infoResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const info = await infoResponse.json();
    businessName = info.verified_name || null;
    displayPhoneNumber = info.display_phone_number || null;
  } catch (err) {
    logger.warn("Conectado, mas não foi possível buscar nome/telefone pra exibição.", err);
  }

  const batch = db.batch();
  batch.set(integrationRef(orgId), {
    wabaId,
    phoneNumberId,
    accessToken,
    businessName,
    displayPhoneNumber,
    connectedAt: admin.firestore.FieldValue.serverTimestamp(),
    connectedByUid: request.auth.uid,
  });
  batch.set(routingRef(phoneNumberId), { orgId });
  await batch.commit();

  return { ok: true, businessName, displayPhoneNumber };
});

// Botão "Desconectar" — remove a conexão e o roteamento dessa clínica.
// Não revoga o token do lado da Meta (a Graph API de revogação de
// assinatura de app por WABA pode ser adicionada depois se necessário);
// localmente, o efeito já é o esperado: paramos de processar mensagens
// dessa clínica e o status volta a mostrar "não conectado".
exports.disconnectWhatsapp = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  const orgId = await getOrgIdForUid(request.auth.uid);
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Usuário sem organização associada.");
  }

  const snap = await integrationRef(orgId).get();
  if (snap.exists) {
    const { phoneNumberId } = snap.data();
    const batch = db.batch();
    batch.delete(integrationRef(orgId));
    if (phoneNumberId) batch.delete(routingRef(phoneNumberId));
    await batch.commit();
  }

  return { ok: true };
});

// Cria (ou reaproveita) uma conversa antes da primeira mensagem — usado pelo
// botão de WhatsApp na ficha do paciente, para a conversa já aparecer na lista.
exports.startConversation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  const orgId = await getOrgIdForUid(request.auth.uid);
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Usuário sem organização associada.");
  }
  const integSnap = await integrationRef(orgId).get();
  if (!integSnap.exists) {
    throw new HttpsError("failed-precondition", "WhatsApp não conectado para esta clínica.");
  }

  const conversationId = normalizePhone(request.data?.tutorTelefone);
  if (!conversationId) {
    throw new HttpsError("invalid-argument", "Telefone do tutor inválido.");
  }

  const convoRef = conversationsRef(orgId).doc(conversationId);
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
exports.sendWhatsappMessage = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "É necessário estar autenticado.");
  }
  const orgId = await getOrgIdForUid(request.auth.uid);
  if (!orgId) {
    throw new HttpsError("failed-precondition", "Usuário sem organização associada.");
  }
  const integSnap = await integrationRef(orgId).get();
  if (!integSnap.exists) {
    throw new HttpsError("failed-precondition", "WhatsApp não conectado para esta clínica.");
  }
  const { accessToken, phoneNumberId } = integSnap.data();

  const conversationId = String(request.data?.conversationId || "");
  const text = String(request.data?.text || "").trim();
  if (!conversationId || !text) {
    throw new HttpsError("invalid-argument", "conversationId e text são obrigatórios.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  const convoRef = conversationsRef(orgId).doc(conversationId);

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
