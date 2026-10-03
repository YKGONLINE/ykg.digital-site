(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const name = form.elements.namedItem("name");
  const contact = form.elements.namedItem("reply_to");
  const message = form.querySelector("textarea[data-message-field]") || form.elements.namedItem("message");
  const messagePayload = form.elements.namedItem("message");
  const messageLimit = 1024;
  const limitHelp = document.getElementById("message-limit-help");
  const requestId = form.elements.namedItem("request_id");
  const button = form.querySelector(".send-button");
  const label = button.querySelector(".send-label");
  const status = document.getElementById("contact-status");
  const fallback = document.getElementById("contact-fallback");
  const endpoint = form.dataset.endpoint.trim();
  const successMessage = form.dataset.successMessage || "Mesajınız gönderildi. Bıraktığınız iletişim bilgisinden size döneceğiz.";
  const messagePrefix = form.dataset.messagePrefix || "";
  const security = window.YKG_FORM_SECURITY;
  const secured = window.YKG_FORM_SECURITY_CONFIG?.enabled === true;
  const configured = secured ? security?.configured === true : /^https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/ykg\.digital\/s)\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
  const minimumAnimationMs = 2400;
  let pending = null;
  let successTimer = 0;

  const setStatus = (text, tone = "") => {
    status.textContent = text;
    status.classList.toggle("is-error", tone === "error");
    status.classList.toggle("is-success", tone === "success");
  };

  const validContact = (value) => {
    const trimmed = value.trim();
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const digits = trimmed.replace(/\D/g, "");
    const phone = digits.length >= 7 && digits.length <= 16 && /^[+\d\s().-]+$/.test(trimmed);
    return email || phone;
  };

  const updateButton = () => {
    if (pending || successTimer) return;
    const hasMessage = message.value.length > 0;
    button.classList.toggle("is-visible", hasMessage);
    button.setAttribute("aria-hidden", String(!hasMessage));
    button.tabIndex = hasMessage ? 0 : -1;
  };

  const updateMessageLimit = () => {
    if (limitHelp) limitHelp.hidden = message.value.length < messageLimit;
  };

  const validate = () => {
    name.setCustomValidity(name.value.trim() ? "" : "Lütfen adınızı yazın.");
    contact.setCustomValidity(validContact(contact.value) ? "" : "Lütfen geçerli bir e-posta adresi ya da telefon numarası yazın.");
    message.setCustomValidity(message.value.length > messageLimit
      ? "Mesajınız en fazla 1024 karakter olabilir." : message.value.trim() ? "" : "Lütfen mesajınızı yazın.");
    return form.reportValidity();
  };

  const newRequestId = () => {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const unlockFields = () => {
    [name, contact, message].forEach((field) => { field.readOnly = false; });
  };

  const finish = (result) => {
    if (!pending) return;
    if (secured) security.reset();
    window.clearInterval(pending.blinkTimer);
    window.clearTimeout(pending.timeoutTimer);
    button.classList.remove("is-zero", "is-one");

    if (!result.ok) {
      button.classList.remove("is-animating", "is-complete");
      button.disabled = false;
      button.setAttribute("aria-label", "Mesajı yeniden gönder");
      label.textContent = "Yeniden dene";
      unlockFields();
      pending = null;
      const errorMessages = {
        rate_limit: "Bu internet bağlantısının günlük 5 mesaj sınırına ulaşıldı. Yarın tekrar deneyin veya e-posta ile ulaşın.",
        verification_failed: "Güvenlik kontrolü tamamlanamadı. Tekrar deneyin.",
        delivery_unknown: "Gönderim sonucu doğrulanamadı. Mesaj ulaşmış olabilir; yeniden göndermeden önce e-posta ile ulaşın."
      };
      setStatus(errorMessages[result.code] || "Mesaj gönderilemedi. Tekrar deneyin veya e-posta ile ulaşın.", "error");
      fallback.hidden = false;
      fallback.innerHTML = 'Gönderim sürmezse <a href="mailto:ykg@ykg.digital">e-posta ile ulaşın</a>.';
      return;
    }

    button.classList.remove("is-animating");
    button.classList.add("is-complete");
    window.setTimeout(() => {
      button.classList.remove("is-complete");
      button.disabled = true;
      button.setAttribute("aria-label", "Mesaj gönderildi");
      label.textContent = "Gönderildi";
      setStatus(successMessage, "success");
      form.reset();
      requestId.value = "";
      unlockFields();
      pending = null;
      successTimer = window.setTimeout(() => {
        successTimer = 0;
        button.disabled = false;
        button.setAttribute("aria-label", "Mesajı gönder");
        label.textContent = "Gönder";
        updateButton();
      }, 2200);
    }, 650);
  };

  const receiveResult = (result) => {
    if (!pending || pending.result || (result.requestId && result.requestId !== pending.id)) return;
    pending.result = result;
    const wait = Math.max(0, minimumAnimationMs - (performance.now() - pending.startedAt));
    window.setTimeout(() => finish(result), wait);
  };

  if (configured) { fallback.hidden = true; setStatus(""); }

  if (configured && !secured) {
    const frame = document.createElement("iframe");
    frame.name = "ykg-contact-response";
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    document.body.append(frame);
    form.action = endpoint;
    form.target = frame.name;
    fallback.hidden = true;
    setStatus("");

    window.addEventListener("message", (event) => {
      const googleOrigin = event.origin === "https://script.google.com"
        || /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com$/.test(event.origin);
      const result = event.data;
      if (!googleOrigin || !pending || !result || result.kind !== "ykg-contact-result"
        || result.requestId !== pending.id || typeof result.ok !== "boolean") return;
      receiveResult(result);
    });
  } else if (!configured) {
    setStatus("Form henüz etkin değil. Şimdilik e-posta ile ulaşın.", "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (pending || successTimer || !validate()) return;
    if (!configured) {
      setStatus("Form henüz etkin değil. Şimdilik e-posta ile ulaşın.", "error");
      return;
    }

    if (!requestId.value) requestId.value = newRequestId();
    if (messagePayload !== message) messagePayload.value = `${messagePrefix}\n\n${message.value.trim()}`;
    button.disabled = true;
    button.setAttribute("aria-label", "Mesaj gönderiliyor");
    label.textContent = "Gönder";
    button.classList.add("is-animating", "is-zero");
    button.classList.remove("is-one", "is-complete");
    fallback.hidden = true;
    setStatus("Mesaj gönderiliyor…");

    pending = { id: requestId.value, startedAt: performance.now(), result: null, blinkTimer: 0, timeoutTimer: 0 };
    let phase = 0;
    pending.blinkTimer = window.setInterval(() => {
      phase += 1;
      button.classList.toggle("is-zero", phase % 2 === 0);
      button.classList.toggle("is-one", phase % 2 === 1);
    }, 300);
    pending.timeoutTimer = window.setTimeout(() => receiveResult({ ok: false, code: "delivery_unknown" }), secured ? 195000 : 30000);

    try {
      if (secured) {
        const submittedId = requestId.value;
        security.submit({ name: name.value, reply_to: contact.value, message: message.value,
          request_id: submittedId, website: form.elements.namedItem('website')?.value || '' }, () => setStatus('Bir sonraki mesaj için güvenlik kontrolünü tamamlayın.'))
          .then(receiveResult).catch(error => receiveResult({ requestId: submittedId, ok: false,
            code: error.message === 'verification_failed' ? 'verification_failed' : 'delivery_unknown' }));
      } else {
        HTMLFormElement.prototype.submit.call(form);
      }
      [name, contact, message].forEach((field) => { field.readOnly = true; });
    } catch (_) {
      receiveResult({ ok: false });
    }
  });

  [name, contact, message].forEach((field) => {
    field.addEventListener("input", () => {
      field.setCustomValidity("");
      if (!pending) requestId.value = "";
      if (successTimer) {
        window.clearTimeout(successTimer);
        successTimer = 0;
        button.disabled = false;
        button.setAttribute("aria-label", "Mesajı gönder");
        label.textContent = "Gönder";
      }
      updateMessageLimit();
      updateButton();
    });
  });

  form.addEventListener("reset", () => {
    queueMicrotask(updateMessageLimit);
  });

  // Restored textarea values can be present before an input event fires.
  updateMessageLimit();
  updateButton();
})();
