// Aynı menü ana sayfada ve iç sayfalarda kullanılır; film koduna bağlı değildir.
const root = document.documentElement;
const button = document.getElementById("menu-btn");
const menu = document.getElementById("menu");
const brand = document.getElementById("brand");
const main = document.querySelector("main");
const footer = document.querySelector("footer");

if (button && menu) {
  const path = location.pathname === "/index.html" ? "/" : location.pathname;
  const links = [...menu.querySelectorAll("a[href]")];
  const pageLinks = links.filter((link) => link.pathname !== "/" || !link.hash);
  for (const link of pageLinks) {
    if (link.pathname === path && !link.hash) link.setAttribute("aria-current", "page");
  }

  // Ana sayfada İletişim görünürken konumu belirt; filmde hiçbir madde etkin değildir.
  if (path === "/") {
    const contact = document.getElementById("iletisim");
    const contactLink = links.find((link) => link.getAttribute("href") === "/#iletisim");
    if (contact && contactLink) {
      const markContact = () => {
        const bounds = contact.getBoundingClientRect();
        const line = window.innerHeight * 0.3;
        if (bounds.top <= line && bounds.bottom >= line) contactLink.setAttribute("aria-current", "location");
        else contactLink.removeAttribute("aria-current");
      };
      window.addEventListener("scroll", markContact, { passive: true });
      window.addEventListener("resize", markContact);
      window.addEventListener("load", markContact);
      markContact();
    }
  }

  const background = [brand, main, footer].filter(Boolean);
  let priorInert = [];
  function setMenu(open) {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    if (open) button.classList.add("has-opened");
    root.classList.toggle("menu-open", open);
    if (open) {
      priorInert = background.map((element) => element.inert);
      background.forEach((element) => { element.inert = true; });
      menu.querySelector("a")?.focus();
    } else {
      background.forEach((element, index) => { element.inert = priorInert[index] ?? false; });
      priorInert = [];
    }
  }

  button.addEventListener("click", () => {
    const open = menu.hidden;
    setMenu(open);
    if (!open) button.focus();
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (event) => {
    if (menu.hidden) return;
    if (event.key === "Escape") {
      setMenu(false);
      button.focus();
    } else if (event.key === "Tab") {
      const focusable = [button, ...links];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener("pageshow", () => {
    if (!menu.hidden) setMenu(false);
  });
}
