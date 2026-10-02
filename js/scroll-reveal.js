// Ana sayfa ve iç sayfa içerikleri, görünür alana girdiğinde bir kez yumuşakça belirir.
if ("IntersectionObserver" in window) {
  const items = document.querySelectorAll(
    ".content .company > h2, .content .company > p, .content .pillars > li, " +
    ".inner-main > h1, .inner-main > .work-intro, .inner-copy > p, .inner-next, " +
    ".work-section, .inner-main > .work-contact, .sapiens-tagline, .sapiens-intro, " +
    ".sapiens-process, .sapiens-section, .sapiens-closing"
  );
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, { threshold: 0.08, rootMargin: "0px 0px -8% 0px" });

  let cardIndex = 0;
  items.forEach((item) => {
    if (item.matches(".pillars > li")) {
      item.style.setProperty("--reveal-delay", `${cardIndex * 65}ms`);
      cardIndex += 1;
    }
    item.classList.add("scroll-reveal");
    observer.observe(item);
  });
}
