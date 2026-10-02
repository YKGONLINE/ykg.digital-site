(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const name = form.elements.namedItem("name");
  const contact = form.elements.namedItem("reply_to");
  const message = form.querySelector("textarea[data-message-field]") || form.elements.namedItem("message");
  const messagePayload = form.elements.namedItem("message");
  const requestId = form.elements.namedItem("request_id");
  const button = form.querySelector(".send-button");
  const label = button.querySelector(".send-label");
  const status = document.getElementById("contact-status");
  const fallback = document.getElementById("contact-fallback");
  const endpoint = form.dataset.endpoint.trim();
  const successMessage = form.dataset.successMessage || "Mesajınız gönderildi. Bıraktığınız iletişim bilgisinden size döneceğiz.";
  const messagePrefix = form.dataset.messagePrefix || "";
  const configured = /^https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/ykg\.digital\/s)\/[A-Za-z0-9_-]+\/exec$/.test(endpoint);
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

  const validate = () => {
    name.setCustomValidity(name.value.trim() ? "" : "Lütfen adınızı yazın.");
    contact.setCustomValidity(validContact(contact.value) ? "" : "Lütfen geçerli bir e-posta adresi ya da telefon numarası yazın.");
    message.setCustomValidity(message.value.trim() ? "" : "Lütfen mesajınızı yazın.");
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
      setStatus("Mesaj gönderilemedi. Tekrar deneyin veya e-posta ile ulaşın.", "error");
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
    if (!pending || pending.result) return;
    pending.result = result;
    const wait = Math.max(0, minimumAnimationMs - (performance.now() - pending.startedAt));
    window.setTimeout(() => finish(result), wait);
  };

  if (configured) {
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
  } else {
    setStatus("Form henüz etkin değil. Şimdilik e-posta ile ulaşın.", "error");
  }

  form.addEventListener("submit", (event) => {
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
    pending.timeoutTimer = window.setTimeout(() => receiveResult({ ok: false }), 30000);

    try {
      HTMLFormElement.prototype.submit.call(form);
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
      updateButton();
    });
  });

  // Restored textarea values can be present before an input event fires.
  updateButton();
})();
