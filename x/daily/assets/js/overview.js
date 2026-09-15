(() => {
  const links = document.querySelectorAll("[data-daily-category-link]");
  const transition = document.querySelector("[data-overview-transition]");
  if (!links.length || !transition) return;

  let navigating = false;

  const shouldHandleClick = (event, link) => {
    if (event.defaultPrevented || navigating) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target && link.target !== "_self") return false;
    return true;
  };

  for (const link of links) {
    link.addEventListener("click", (event) => {
      if (!shouldHandleClick(event, link)) return;

      event.preventDefault();
      navigating = true;
      link.classList.add("is-entering");
      document.documentElement.classList.add("daily-is-navigating");
      transition.classList.add("is-active");

      const destination = link.href;
      let didNavigate = false;
      const navigate = () => {
        if (didNavigate) return;
        didNavigate = true;
        window.location.assign(destination);
      };

      transition.addEventListener("animationend", navigate, { once: true });
      window.setTimeout(navigate, 420);
    });
  }
})();
