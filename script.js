const DATA_URL = "https://raw.githubusercontent.com/rsvp0/Nilda-Sunset/refs/heads/main/convites.json";
const INVITE_BASE_URL = "https://rsvp0.github.io/Nilda-Sunset/";
const STORAGE_KEY = "nilda-sunset-sharing-state";
const SHARE_TITLE = "Nilda Sunset";
const $ = selector => document.querySelector(selector);

let invites = [];
let filter = "all";
let storageWarning = "";
let sharingState = readSharingState();

function normalizeText(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function readSharingState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    storageWarning = "Não foi possível ler o estado local de envio. A lista continua disponível.";
    return {};
  }
}

function saveSharingState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sharingState));
    return true;
  } catch {
    setStatus("Não foi possível salvar o estado de enviado neste navegador.", "error");
    return false;
  }
}

function setStatus(message = "", type = "") {
  const status = $("#status");
  status.textContent = message;
  status.className = `status ${type}`;
}

function isValidInvite(invite) {
  return invite && Array.isArray(invite.names) && invite.names.length && typeof invite.message === "string" && /^[A-Za-z0-9_-]+$/.test(invite.hash || "");
}

function inviteLink(invite) {
  const url = new URL(INVITE_BASE_URL);
  url.searchParams.set("hash", invite.hash);
  return url.href;
}

function isSent(invite) {
  return sharingState[invite.hash] === true;
}

function updateSent(invite, sent) {
  sharingState[invite.hash] = sent;
  saveSharingState();
  render();
}

async function loadInvites() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`O servidor respondeu com erro ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("O arquivo de convites possui um formato inválido.");
    const invalid = data.filter(invite => !isValidInvite(invite)).length;
    invites = data.filter(isValidInvite);
    const message = [storageWarning, invalid ? `${invalid} convite(s) inválido(s) foram ignorados.` : ""].filter(Boolean).join(" ");
    setStatus(message, message ? "error" : "");
    render();
  } catch (error) {
    invites = [];
    render();
    setStatus(`Não foi possível carregar a lista de convites. Verifique sua conexão e tente recarregar a página. ${error.message}`, "error");
  }
}

function filteredInvites() {
  const search = normalizeText($("#search").value.trim());
  return invites.filter(invite => {
    const matchesName = !search || normalizeText(invite.names.join(" ")).includes(search);
    const matchesFilter = filter === "all" || (filter === "sent" ? isSent(invite) : !isSent(invite));
    return matchesName && matchesFilter;
  });
}

function createButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  return button;
}

async function shareInvite(invite) {
  const link = inviteLink(invite);

  if (typeof navigator.share !== "function") {
    setStatus(
      "O compartilhamento nativo não está disponível. Abra o site pelo endereço HTTPS.",
      "error"
    );
    return;
  }

  try {
    await navigator.share({
      title: SHARE_TITLE,
      text: invite.message,
      url: link
    });

    updateSent(invite, true);
    setStatus("Convite compartilhado.", "success");
  } catch (error) {
    if (error.name === "AbortError") {
      return;
    }

    console.error("Erro ao compartilhar:", error);
    setStatus("Não foi possível abrir o compartilhamento.", "error");
  }
}

async function copyShareContent(invite) {
  const content = `${invite.message}\n\n${inviteLink(invite)}`;
  try {
    await navigator.clipboard.writeText(content);
    setStatus("Mensagem e link copiados. Marque como enviado quando concluir o compartilhamento.", "success");
  } catch {
    window.prompt("Copie a mensagem e o link:", content);
  }
}

async function copyLink(invite) {
  try {
    await navigator.clipboard.writeText(inviteLink(invite));
    setStatus("Link copiado.", "success");
  } catch {
    window.prompt("Copie o link do convite:", inviteLink(invite));
  }
}

function inviteCard(invite) {
  const sent = isSent(invite);
  const card = document.createElement("article");
  const details = document.createElement("div");
  const title = document.createElement("h2");
  const meta = document.createElement("p");
  const actions = document.createElement("div");
  const control = document.createElement("label");
  const checkbox = document.createElement("input");
  card.className = `invite${sent ? " sent" : ""}`;
  title.textContent = invite.names.join(", ");
  meta.textContent = `${invite.companions || 0} acompanhante(s)`;
  if (invite.confirmed === true) {
    const badge = document.createElement("span");
    badge.className = "badge confirmed";
    badge.textContent = "Confirmado";
    details.append(title, meta, badge);
  } else {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = sent ? "Enviado" : "Pendente";
    details.append(title, meta, badge);
  }
  checkbox.type = "checkbox";
  checkbox.checked = sent;
  checkbox.addEventListener("change", () => updateSent(invite, checkbox.checked));
  control.className = "sent-control";
  control.append(checkbox, " Enviado");
  actions.className = "invite-actions";
  actions.append(control, createButton("Compartilhar", "share", () => shareInvite(invite)), createButton("Copiar link", "copy", () => copyLink(invite)));
  card.append(details, actions);
  return card;
}

function renderStats() {
  const sent = invites.filter(isSent).length;
  $("#totalCount").textContent = invites.length;
  $("#sentCount").textContent = sent;
  $("#pendingCount").textContent = invites.length - sent;
}

function render() {
  const list = $("#inviteList");
  const visible = filteredInvites();
  list.replaceChildren(...visible.map(inviteCard));
  $("#emptyState").hidden = visible.length > 0;
  renderStats();
}

$("#search").addEventListener("input", render);
document.querySelectorAll(".filter").forEach(button => button.addEventListener("click", () => {
  filter = button.dataset.filter;
  document.querySelectorAll(".filter").forEach(item => item.classList.toggle("active", item === button));
  render();
}));

loadInvites();
